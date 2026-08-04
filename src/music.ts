export type DegreeRole =
  | "root"
  | "third"
  | "fifth"
  | "seventh"
  | "sixth"
  | "suspension"
  | "extension"
  | "bass";

export type ChordTone = {
  interval: number;
  pitchClass: number;
  role: DegreeRole;
  degree: string;
  omissionCost: number;
};

export type Chord = {
  raw: string;
  root: number;
  rootName: string;
  bass: number | null;
  quality: string;
  tones: ChordTone[];
};

export type Position = {
  string: number;
  fret: number;
  pitchClass: number;
  midi: number;
  toneIndex: number;
  role: DegreeRole;
};

type FormulaTone = Omit<ChordTone, "pitchClass">;

const tone = (interval: number, role: DegreeRole, degree: string, omissionCost: number): FormulaTone => ({
  interval,
  role,
  degree,
  omissionCost,
});

const R = tone(0, "root", "1", 70);
const M3 = tone(4, "third", "3", 130);
const m3 = tone(3, "third", "♭3", 130);
const P5 = tone(7, "fifth", "5", 12);
const d5 = tone(6, "fifth", "♭5", 105);
const A5 = tone(8, "fifth", "♯5", 105);
const m7 = tone(10, "seventh", "♭7", 125);
const M7 = tone(11, "seventh", "7", 125);
const d7 = tone(9, "seventh", "♭♭7", 105);
const M6 = tone(9, "sixth", "6", 90);
const M2 = tone(2, "suspension", "2", 125);
const P4 = tone(5, "suspension", "4", 125);
const N9 = tone(2, "extension", "9", 80);

const FORMULAS: Record<string, FormulaTone[]> = {
  maj: [R, M3, P5],
  m: [R, m3, P5],
  "7": [R, M3, P5, m7],
  maj7: [R, M3, P5, M7],
  m7: [R, m3, P5, m7],
  dim: [R, m3, d5],
  dim7: [R, m3, d5, d7],
  m7b5: [R, m3, d5, m7],
  aug: [R, M3, A5],
  "6": [R, M3, P5, M6],
  m6: [R, m3, P5, M6],
  sus2: [R, M2, P5],
  sus4: [R, P4, P5],
  add9: [R, M3, P5, N9],
  "9": [R, M3, P5, m7, N9],
  m9: [R, m3, P5, m7, N9],
  maj9: [R, M3, P5, M7, N9],
};

const ALIASES: Record<string, string> = {
  "": "maj",
  maj: "maj",
  m: "m",
  min: "m",
  "-": "m",
  "7": "7",
  maj7: "maj7",
  M7: "maj7",
  "Δ7": "maj7",
  m7: "m7",
  min7: "m7",
  "-7": "m7",
  dim: "dim",
  "°": "dim",
  o: "dim",
  dim7: "dim7",
  "°7": "dim7",
  o7: "dim7",
  m7b5: "m7b5",
  min7b5: "m7b5",
  "ø": "m7b5",
  "ø7": "m7b5",
  aug: "aug",
  "+": "aug",
  "6": "6",
  m6: "m6",
  min6: "m6",
  sus: "sus4",
  sus2: "sus2",
  sus4: "sus4",
  add9: "add9",
  "9": "9",
  m9: "m9",
  min9: "m9",
  maj9: "maj9",
  M9: "maj9",
  "Δ9": "maj9",
};

const ROOTS: Record<string, number> = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, Fb: 4, "E#": 5, F: 5, "F#": 6, Gb: 6, G: 7,
  "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};

export const OPEN_PITCH_CLASSES = [7, 2, 9, 4]; // G D A E, visual order
export const OPEN_MIDI = [43, 38, 33, 28];
export const STRING_NAMES = ["G", "D", "A", "E"];

const normalizeAccidentals = (value: string) => value.replaceAll("♭", "b").replaceAll("♯", "#");

export function parseChord(raw: string): Chord | null {
  const clean = normalizeAccidentals(raw.trim());
  const match = clean.match(/^([A-Ga-g])([#b]?)([^/]*)(?:\/([A-Ga-g])([#b]?))?$/);
  if (!match) return null;

  const rootName = match[1].toUpperCase() + match[2];
  const qualityInput = match[3];
  const quality = ALIASES[qualityInput] ?? ALIASES[qualityInput.toLowerCase()];
  const root = ROOTS[rootName];
  if (root === undefined || quality === undefined) return null;

  const bassName = match[4] ? match[4].toUpperCase() + match[5] : null;
  const bass = bassName ? ROOTS[bassName] : null;
  if (bassName && bass === undefined) return null;

  const formulaTones = FORMULAS[quality].map((item) => ({
    ...item,
    pitchClass: (root + item.interval) % 12,
  }));
  if (bass !== null && !formulaTones.some((item) => item.pitchClass === bass)) {
    formulaTones.push({
      interval: (bass - root + 12) % 12,
      pitchClass: bass,
      role: "bass",
      degree: "bass",
      omissionCost: 160,
    });
  }

  return {
    raw,
    root,
    rootName,
    bass,
    quality,
    tones: formulaTones,
  };
}

export function parseProgression(input: string) {
  const tokens = input.split(/[\s,;]+/).filter(Boolean);
  const parsed = tokens.map((token) => ({ token, chord: parseChord(token) }));
  return {
    chords: parsed.flatMap(({ chord }) => chord ? [chord] : []),
    invalid: parsed.flatMap(({ token, chord }) => chord ? [] : [token]),
  };
}

const SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

export function noteName(pitchClass: number, chord?: Chord) {
  return (chord?.rootName.includes("b") ? FLAT_NAMES : SHARP_NAMES)[pitchClass];
}

export function candidates(chord: Chord, from: number, to: number): Position[][] {
  const choices = chord.tones.map((chordTone, toneIndex) => {
    const found: Position[] = [];
    OPEN_PITCH_CLASSES.forEach((open, string) => {
      for (let fret = from; fret <= to; fret += 1) {
        if ((open + fret) % 12 === chordTone.pitchClass) {
          found.push({
            string,
            fret,
            pitchClass: chordTone.pitchClass,
            midi: OPEN_MIDI[string] + fret,
            toneIndex,
            role: chordTone.role,
          });
        }
      }
    });
    return found;
  });

  const result: Position[][] = [];
  const minimumNotes = Math.min(3, chord.tones.length);
  if (choices.filter((positions) => positions.length > 0).length < minimumNotes) return [];

  const walk = (index: number, usedStrings: Set<number>, selected: Position[]) => {
    if (index === choices.length) {
      if (selected.length < minimumNotes) return;
      if (chord.bass !== null) {
        const lowest = selected.reduce((best, position) => position.midi < best.midi ? position : best);
        if (lowest.pitchClass !== chord.bass) return;
      }
      result.push([...selected]);
      return;
    }

    for (const position of choices[index]) {
      if (usedStrings.has(position.string)) continue;
      usedStrings.add(position.string);
      selected.push(position);
      walk(index + 1, usedStrings, selected);
      selected.pop();
      usedStrings.delete(position.string);
    }

    if (chord.tones.length > 3) walk(index + 1, usedStrings, selected);
  };

  walk(0, new Set(), []);
  return result
    .sort((a, b) => shapeCost(chord, a) - shapeCost(chord, b))
    .slice(0, 120);
}

export function omittedTones(chord: Chord, voicing: Position[]) {
  const present = new Set(voicing.map((position) => position.toneIndex));
  return chord.tones.filter((_, index) => !present.has(index));
}

function spread(voicing: Position[]) {
  const frets = voicing.map((position) => position.fret);
  return Math.max(...frets) - Math.min(...frets);
}

function center(voicing: Position[]) {
  return voicing.reduce((total, position) => total + position.fret, 0) / voicing.length;
}

function shapeCost(chord: Chord, voicing: Position[]) {
  const omissionPenalty = omittedTones(chord, voicing)
    .reduce((total, chordTone) => total + chordTone.omissionCost, 0);
  const openStringPenalty = voicing.filter((position) => position.fret === 0).length * 0.35;
  return omissionPenalty + spread(voicing) * 1.4 + openStringPenalty;
}

function voiceLeadingCost(previous: Position[], current: Position[]) {
  const previousVoices = [...previous].sort((a, b) => a.midi - b.midi);
  const currentVoices = [...current].sort((a, b) => a.midi - b.midi);
  const voiceCount = Math.min(previousVoices.length, currentVoices.length);
  let cost = Math.abs(center(previous) - center(current)) * 0.8;

  for (let index = 0; index < voiceCount; index += 1) {
    const before = previousVoices[index];
    const after = currentVoices[index];
    cost += Math.abs(before.midi - after.midi) * 0.22;
    cost += Math.abs(before.string - after.string) * 0.35;
    if (before.string === after.string && before.fret === after.fret) cost -= 1.5;
  }

  return cost + Math.abs(previous.length - current.length) * 2;
}

export function optimize(chords: Chord[], from: number, to: number): Position[][] {
  const candidateSets = chords.map((chord) => candidates(chord, from, to));
  if (candidateSets.some((set) => set.length === 0)) return [];

  let states = candidateSets[0].map((voicing) => ({
    path: [voicing],
    cost: shapeCost(chords[0], voicing),
  }));

  for (let chordIndex = 1; chordIndex < candidateSets.length; chordIndex += 1) {
    states = candidateSets[chordIndex].map((voicing) => {
      let best = states[0];
      let bestCost = Number.POSITIVE_INFINITY;
      for (const previous of states) {
        const cost = previous.cost
          + shapeCost(chords[chordIndex], voicing)
          + voiceLeadingCost(previous.path.at(-1)!, voicing);
        if (cost < bestCost) {
          bestCost = cost;
          best = previous;
        }
      }
      return { path: [...best.path, voicing], cost: bestCost };
    });
  }

  return states.sort((a, b) => a.cost - b.cost)[0]?.path ?? [];
}
