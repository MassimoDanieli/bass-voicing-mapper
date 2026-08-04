import type { Chord, SongStep } from "./music";
import { beatGrid, locate } from "./transport";

export type BackingStyle = "straight" | "swing" | "bossa";
export type DrumKind = "kick" | "snare" | "hat" | "ride" | "rim";

export type BackingEvent =
  | { type: "drum"; kind: DrumKind; beat: number; gain: number }
  | { type: "comp"; notes: number[]; beat: number; gain: number; duration: number };

/** Comping sits around the middle of a piano, well clear of the bass. */
const COMP_LOW = 52;
const COMP_HIGH = 76;
const COMP_CENTER = 62;
const MAX_COMP_NOTES = 4;

/** Swung eighths: the off-beat lands two thirds of the way through the beat. */
const SWUNG = 2 / 3;

type Pattern = {
  /** Length of the repeating cycle, in beats. */
  cycle: number;
  drums: { beat: number; kind: DrumKind; gain: number }[];
  comp: { beat: number; duration: number; gain: number }[];
};

const PATTERNS: Record<BackingStyle, Pattern> = {
  straight: {
    cycle: 4,
    drums: [
      { beat: 0, kind: "kick", gain: 1 },
      { beat: 1, kind: "snare", gain: 0.85 },
      { beat: 2, kind: "kick", gain: 0.8 },
      { beat: 3, kind: "snare", gain: 0.85 },
      ...[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((beat) => ({
        beat,
        kind: "hat" as const,
        gain: beat % 1 === 0 ? 0.5 : 0.32,
      })),
    ],
    comp: [
      { beat: 0, duration: 1.6, gain: 0.9 },
      { beat: 2, duration: 1.6, gain: 0.75 },
    ],
  },
  swing: {
    cycle: 4,
    drums: [
      // Ride: the spang-a-lang, with the skip note swung.
      { beat: 0, kind: "ride", gain: 0.75 },
      { beat: 1, kind: "ride", gain: 0.6 },
      { beat: 1 + SWUNG, kind: "ride", gain: 0.45 },
      { beat: 2, kind: "ride", gain: 0.7 },
      { beat: 3, kind: "ride", gain: 0.6 },
      { beat: 3 + SWUNG, kind: "ride", gain: 0.45 },
      // Hi-hat pedal on 2 and 4.
      { beat: 1, kind: "hat", gain: 0.5 },
      { beat: 3, kind: "hat", gain: 0.5 },
      { beat: 0, kind: "kick", gain: 0.4 },
    ],
    // Charleston: downbeat and the and-of-two, swung.
    comp: [
      { beat: 0, duration: 1.2, gain: 0.85 },
      { beat: 1 + SWUNG, duration: 1.4, gain: 0.7 },
    ],
  },
  bossa: {
    cycle: 8,
    drums: [
      // 3–2 clave on the rim.
      ...[0, 1.5, 3, 5, 6].map((beat) => ({ beat, kind: "rim" as const, gain: 0.6 })),
      { beat: 0, kind: "kick", gain: 0.8 },
      { beat: 1.5, kind: "kick", gain: 0.6 },
      { beat: 4, kind: "kick", gain: 0.8 },
      { beat: 5.5, kind: "kick", gain: 0.6 },
      ...Array.from({ length: 16 }, (_, index) => ({
        beat: index * 0.5,
        kind: "hat" as const,
        gain: index % 2 === 0 ? 0.34 : 0.24,
      })),
    ],
    comp: [
      { beat: 0, duration: 1.4, gain: 0.8 },
      { beat: 2.5, duration: 1.2, gain: 0.65 },
      { beat: 4.5, duration: 1.4, gain: 0.72 },
      { beat: 6, duration: 1.2, gain: 0.6 },
    ],
  },
};

/** How much a tone is wanted in a comping voicing. Higher stays. */
const COMP_PRIORITY: Record<string, number> = {
  third: 100,
  seventh: 95,
  extension: 70,
  sixth: 65,
  suspension: 60,
  fifth: 20,
  root: 0,
  bass: 0,
};

/**
 * Rootless comping. The player is the bass, so doubling the root muddies the
 * register that matters to them and wastes a voice.
 */
export function compVoicing(chord: Chord, previous: number[] = []): number[] {
  const usable = chord.tones.filter((tone) => tone.role !== "root" && tone.role !== "bass");
  const unique = [...new Map(usable.map((tone) => [tone.pitchClass, tone])).values()];
  const ranked = unique
    .filter((tone) => tone.role !== "fifth")
    .sort((a, b) => (COMP_PRIORITY[b.role] ?? 0) - (COMP_PRIORITY[a.role] ?? 0))
    .slice(0, MAX_COMP_NOTES);

  // The fifth only earns a place when the chord is too plain to fill one without it.
  const fifths = unique.filter((tone) => tone.role === "fifth");
  const chosen = ranked.length >= 3 ? ranked : [...ranked, ...fifths].slice(0, MAX_COMP_NOTES);
  const pitchClasses = chosen.map((tone) => tone.pitchClass);

  if (!pitchClasses.length) return [];

  const anchor = previous.length
    ? previous.reduce((total, note) => total + note, 0) / previous.length
    : COMP_CENTER;

  const notes = pitchClasses.map((pitchClass) => {
    let best = pitchClass;
    while (best < COMP_LOW) best += 12;
    let closest = best;
    for (let note = best; note <= COMP_HIGH; note += 12) {
      if (Math.abs(note - anchor) < Math.abs(closest - anchor)) closest = note;
    }
    return closest;
  });

  return [...new Set(notes)].sort((a, b) => a - b);
}

/**
 * Turns a progression into a flat list of timed events, in beats from the start.
 * Everything here is arithmetic: the audible result is scheduled elsewhere.
 */
export function backingEvents(steps: SongStep[], style: BackingStyle): BackingEvent[] {
  const grid = beatGrid(steps);
  if (!grid.total) return [];

  const pattern = PATTERNS[style];
  const events: BackingEvent[] = [];

  for (let cycleStart = 0; cycleStart < grid.total; cycleStart += pattern.cycle) {
    for (const hit of pattern.drums) {
      const beat = cycleStart + hit.beat;
      if (beat < grid.total) events.push({ type: "drum", kind: hit.kind, beat, gain: hit.gain });
    }
  }

  // Pattern hits, plus a hit on every chord change so a mid-bar change is heard.
  const compBeats = new Map<number, { duration: number; gain: number }>();
  for (let cycleStart = 0; cycleStart < grid.total; cycleStart += pattern.cycle) {
    for (const hit of pattern.comp) {
      const beat = cycleStart + hit.beat;
      if (beat < grid.total) compBeats.set(beat, { duration: hit.duration, gain: hit.gain });
    }
  }
  for (const start of grid.starts) {
    if (!compBeats.has(start)) compBeats.set(start, { duration: 1.4, gain: 0.8 });
  }

  let previous: number[] = [];
  for (const beat of [...compBeats.keys()].sort((a, b) => a - b)) {
    const at = locate(grid, beat);
    if (!at) continue;
    const notes = compVoicing(steps[at.index].chord, previous);
    if (!notes.length) continue;
    previous = notes;
    const { duration, gain } = compBeats.get(beat)!;
    events.push({ type: "comp", notes, beat, gain, duration });
  }

  return events.sort((a, b) => a.beat - b.beat);
}

export const BACKING_STYLES: BackingStyle[] = ["straight", "swing", "bossa"];
