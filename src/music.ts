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

export type SongStep = {
  chord: Chord;
  beats: number;
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
const m3 = tone(3, "third", "b3", 130);
const P5 = tone(7, "fifth", "5", 12);
const d5 = tone(6, "fifth", "b5", 120);
const A5 = tone(8, "fifth", "#5", 110);
const m7 = tone(10, "seventh", "b7", 125);
const M7 = tone(11, "seventh", "7", 125);
const d7 = tone(9, "seventh", "bb7", 110);
const M6 = tone(9, "sixth", "6", 90);
const M2 = tone(2, "suspension", "2", 125);
const P4 = tone(5, "suspension", "4", 125);
const b9 = tone(1, "extension", "b9", 75);
const N9 = tone(2, "extension", "9", 80);
const s9 = tone(3, "extension", "#9", 75);
const N11 = tone(5, "extension", "11", 75);
const N13 = tone(9, "extension", "13", 80);

const FORMULAS = new Map<string, FormulaTone[]>(Object.entries({
  maj: [R, M3, P5],
  m: [R, m3, P5],
  "5": [R, P5],
  "7": [R, M3, P5, m7],
  maj7: [R, M3, P5, M7],
  m7: [R, m3, P5, m7],
  mmaj7: [R, m3, P5, M7],
  dim: [R, m3, d5],
  dim7: [R, m3, d5, d7],
  m7b5: [R, m3, d5, m7],
  aug: [R, M3, A5],
  "7b5": [R, M3, d5, m7],
  "7#5": [R, M3, A5, m7],
  alt: [R, M3, A5, m7, s9],
  "6": [R, M3, P5, M6],
  m6: [R, m3, P5, M6],
  "69": [R, M3, P5, M6, N9],
  sus2: [R, M2, P5],
  sus4: [R, P4, P5],
  "7sus4": [R, P4, P5, m7],
  "9sus4": [R, P4, P5, m7, N9],
  add9: [R, M3, P5, N9],
  madd9: [R, m3, P5, N9],
  "9": [R, M3, P5, m7, N9],
  m9: [R, m3, P5, m7, N9],
  maj9: [R, M3, P5, M7, N9],
  "7b9": [R, M3, P5, m7, b9],
  "7#9": [R, M3, P5, m7, s9],
  "13": [R, M3, P5, m7, N13],
  m11: [R, m3, P5, m7, N11],
}));

const ALIASES = new Map<string, string>(Object.entries({
  "": "maj",
  maj: "maj",
  M: "maj",
  m: "m",
  min: "m",
  "-": "m",
  "5": "5",
  no3: "5",
  "7": "7",
  maj7: "maj7",
  M7: "maj7",
  ma7: "maj7",
  j7: "maj7",
  "^": "maj7",
  "^7": "maj7",
  "Δ": "maj7",
  "Δ7": "maj7",
  m7: "m7",
  min7: "m7",
  "-7": "m7",
  mmaj7: "mmaj7",
  mM7: "mmaj7",
  minmaj7: "mmaj7",
  "-maj7": "mmaj7",
  "m^7": "mmaj7",
  "mΔ7": "mmaj7",
  dim: "dim",
  "°": "dim",
  o: "dim",
  dim7: "dim7",
  "°7": "dim7",
  o7: "dim7",
  m7b5: "m7b5",
  min7b5: "m7b5",
  "-7b5": "m7b5",
  "m7-5": "m7b5",
  "ø": "m7b5",
  "ø7": "m7b5",
  h: "m7b5",
  h7: "m7b5",
  aug: "aug",
  "+": "aug",
  "7b5": "7b5",
  "7-5": "7b5",
  "7#5": "7#5",
  "7+5": "7#5",
  "7+": "7#5",
  "+7": "7#5",
  aug7: "7#5",
  alt: "alt",
  "7alt": "alt",
  "6": "6",
  m6: "m6",
  min6: "m6",
  "69": "69",
  sus: "sus4",
  sus2: "sus2",
  sus4: "sus4",
  "7sus": "7sus4",
  "7sus4": "7sus4",
  "9sus": "9sus4",
  "9sus4": "9sus4",
  "11": "9sus4",
  add9: "add9",
  madd9: "madd9",
  "9": "9",
  m9: "m9",
  min9: "m9",
  maj9: "maj9",
  M9: "maj9",
  "Δ9": "maj9",
  "7b9": "7b9",
  "7-9": "7b9",
  "7#9": "7#9",
  "7+9": "7#9",
  "13": "13",
  m11: "m11",
  "-11": "m11",
}));

const ROOTS = new Map<string, number>(Object.entries({
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, Fb: 4, "E#": 5, F: 5, "F#": 6, Gb: 6, G: 7,
  "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
}));

export const OPEN_PITCH_CLASSES = [7, 2, 9, 4]; // G D A E, visual order
export const OPEN_MIDI = [43, 38, 33, 28];
export const STRING_NAMES = ["G", "D", "A", "E"];

const MAX_CANDIDATES = 60;

/** Tokens that are notation furniture rather than chords: bar lines, repeats, rests. */
const NOISE = /^(\||\|\||:\||\|:|%|\/|x|N\.?C\.?)$/i;

const normalize = (value: string) =>
  value
    .trim()
    .replaceAll("♭", "b")
    .replaceAll("♯", "#")
    .replace(/[()\s]/g, "")
    .replace(/6\/9/g, "69");

export function parseChord(raw: string): Chord | null {
  const clean = normalize(raw);
  const match = clean.match(/^([A-Ga-g])([#b]?)([^/]*)(?:\/([A-Ga-g])([#b]?))?$/);
  if (!match) return null;

  const rootName = match[1].toUpperCase() + match[2];
  const qualityInput = match[3];
  // Map lookups, not object literals: `Cconstructor` used to resolve through
  // Object.prototype and blow up on FORMULAS[quality].map().
  const quality = ALIASES.get(qualityInput)
    ?? (qualityInput.length > 1 ? ALIASES.get(qualityInput.toLowerCase()) : undefined);
  const root = ROOTS.get(rootName);
  const formula = quality === undefined ? undefined : FORMULAS.get(quality);
  if (root === undefined || quality === undefined || formula === undefined) return null;

  const bassName = match[4] ? match[4].toUpperCase() + match[5] : null;
  const bass = bassName ? ROOTS.get(bassName) : null;
  if (bassName && bass === undefined) return null;

  const tones: ChordTone[] = formula.map((item) => ({
    ...item,
    pitchClass: (root + item.interval) % 12,
  }));

  if (bass !== undefined && bass !== null && !tones.some((item) => item.pitchClass === bass)) {
    const interval = (bass - root + 12) % 12;
    tones.push({
      interval,
      pitchClass: bass,
      role: "bass",
      degree: DEFAULT_DEGREES[interval],
      omissionCost: 160,
    });
  }

  return {
    raw: raw.trim(),
    root,
    rootName,
    bass: bass ?? null,
    quality,
    tones,
  };
}

export function parseProgression(input: string) {
  const tokens = input.split(/[\s,;|]+/).filter(Boolean).filter((token) => !NOISE.test(token));
  const parsed = tokens.map((token) => ({ token, chord: parseChord(token) }));
  return {
    chords: parsed.flatMap(({ chord }) => chord ? [chord] : []),
    invalid: parsed.flatMap(({ token, chord }) => chord ? [] : [token]),
  };
}

/** Progression with per-chord durations: `Am7:4 D7:4 Gmaj7:8`. Beats are whole beats. */
export function parseSong(input: string, defaultBeats: number) {
  const tokens = input.split(/[\s,;|]+/).filter(Boolean).filter((token) => !NOISE.test(token));
  const steps: SongStep[] = [];
  const invalid: string[] = [];

  for (const token of tokens) {
    const duration = token.match(/:(\d+)$/);
    const symbol = duration ? token.slice(0, -duration[0].length) : token;
    const chord = parseChord(symbol);
    if (!chord) {
      invalid.push(token);
      continue;
    }
    steps.push({ chord, beats: Math.max(1, Math.min(64, duration ? Number(duration[1]) : defaultBeats)) });
  }

  return { steps, invalid };
}

const SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11];
const FLAT_ROOTS = new Set([1, 3, 5, 8, 10]); // Db Eb F Ab Bb spell flat by default
const DEFAULT_DEGREES = ["1", "b9", "9", "b3", "3", "4", "b5", "5", "#5", "6", "b7", "7"];

const prefersFlats = (chord?: Chord) =>
  chord ? chord.rootName.includes("b") || (!chord.rootName.includes("#") && FLAT_ROOTS.has(chord.root)) : false;

/** Chromatic fallback for pitches with no degree context. */
export function noteName(pitchClass: number, chord?: Chord) {
  return (prefersFlats(chord) ? FLAT_NAMES : SHARP_NAMES)[pitchClass];
}

/**
 * Spells a chord tone from its degree, so F7 shows E♭ and not D♯.
 * Double accidentals (Bbdim7's ♭♭7) fall back to the plain chromatic name:
 * A𝄫 is correct on paper but useless on a fretboard.
 */
export function spellTone(chord: Chord, chordTone: ChordTone) {
  const number = Number(chordTone.degree.replace(/[^0-9]/g, "")) || 1;
  const rootLetter = LETTERS.indexOf(chord.rootName[0]);
  if (rootLetter < 0) return noteName(chordTone.pitchClass, chord);

  const letter = (rootLetter + number - 1) % 7;
  const natural = LETTER_PITCH_CLASSES[letter];
  const offset = ((chordTone.pitchClass - natural + 18) % 12) - 6;
  if (offset < -1 || offset > 1) return noteName(chordTone.pitchClass, chord);
  return LETTERS[letter] + (offset === 1 ? "♯" : offset === -1 ? "♭" : "");
}

export function candidates(chord: Chord, from: number, to: number): Position[][] {
  return rankCandidates(chord, from, to).map((scored) => scored.voicing);
}

type ScoredVoicing = {
  voicing: Position[];
  shape: number;
  /** Pre-sorted by pitch so voiceLeadingCost does not sort on every comparison. */
  voices: Position[];
  center: number;
};

function rankCandidates(chord: Chord, from: number, to: number): ScoredVoicing[] {
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

  const scored: Array<{ voicing: Position[]; shape: number }> = [];
  const minimumNotes = Math.min(3, chord.tones.length);
  if (choices.filter((positions) => positions.length > 0).length < minimumNotes) return [];

  // Omission cost is accumulated on the way down and the fret spread is measured in a
  // single pass at the leaf: scoring every candidate afterwards was the hot spot.
  const walk = (index: number, usedStrings: Set<number>, selected: Position[], omission: number) => {
    if (index === choices.length) {
      if (selected.length < minimumNotes) return;
      let lowest = selected[0];
      let minFret = selected[0].fret;
      let maxFret = selected[0].fret;
      let openStrings = 0;
      for (const position of selected) {
        if (position.midi < lowest.midi) lowest = position;
        if (position.fret < minFret) minFret = position.fret;
        if (position.fret > maxFret) maxFret = position.fret;
        if (position.fret === 0) openStrings += 1;
      }
      if (chord.bass !== null && lowest.pitchClass !== chord.bass) return;
      scored.push({
        voicing: [...selected],
        shape: omission + (maxFret - minFret) * 1.4 + openStrings * 0.35,
      });
      return;
    }

    for (const position of choices[index]) {
      if (usedStrings.has(position.string)) continue;
      usedStrings.add(position.string);
      selected.push(position);
      walk(index + 1, usedStrings, selected, omission);
      selected.pop();
      usedStrings.delete(position.string);
    }

    if (chord.tones.length > 3) {
      walk(index + 1, usedStrings, selected, omission + chord.tones[index].omissionCost);
    }
  };

  walk(0, new Set(), [], 0);

  return scored
    .sort((a, b) => a.shape - b.shape)
    .slice(0, MAX_CANDIDATES)
    .map(({ voicing, shape }) => ({
      voicing,
      shape,
      voices: [...voicing].sort((a, b) => a.midi - b.midi),
      center: center(voicing),
    }));
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

function voiceLeadingCost(previous: ScoredVoicing, current: ScoredVoicing) {
  const voiceCount = Math.min(previous.voices.length, current.voices.length);
  let cost = Math.abs(previous.center - current.center) * 0.8;

  for (let index = 0; index < voiceCount; index += 1) {
    const before = previous.voices[index];
    const after = current.voices[index];
    cost += Math.abs(before.midi - after.midi) * 0.22;
    cost += Math.abs(before.string - after.string) * 0.35;
    if (before.string === after.string && before.fret === after.fret) cost -= 1.5;
  }

  return cost + Math.abs(previous.voices.length - current.voices.length) * 2;
}

export type VoicingPath = {
  path: Position[][];
  /** Indices of chords with no playable voicing in the requested fret range. */
  unreachable: number[];
};

/**
 * Viterbi over candidate voicings: minimum shape cost plus minimum movement.
 * Chords with no voicing in range are skipped rather than voiding the whole path.
 */
export function optimizePath(chords: Chord[], from: number, to: number): VoicingPath {
  const sets = chords.map((chord) => rankCandidates(chord, from, to));
  const unreachable = sets.flatMap((set, index) => set.length ? [] : [index]);
  const playable = sets.map((set, index) => ({ set, index })).filter(({ set }) => set.length > 0);
  if (!playable.length) return { path: chords.map(() => []), unreachable };

  let costs = playable[0].set.map((candidate) => candidate.shape);
  const parents: number[][] = [];

  for (let step = 1; step < playable.length; step += 1) {
    const previous = playable[step - 1].set;
    const current = playable[step].set;
    const nextCosts = new Array<number>(current.length);
    const parent = new Array<number>(current.length);

    for (let j = 0; j < current.length; j += 1) {
      let bestIndex = 0;
      let bestCost = Number.POSITIVE_INFINITY;
      for (let k = 0; k < previous.length; k += 1) {
        const cost = costs[k] + voiceLeadingCost(previous[k], current[j]);
        if (cost < bestCost) {
          bestCost = cost;
          bestIndex = k;
        }
      }
      nextCosts[j] = bestCost + current[j].shape;
      parent[j] = bestIndex;
    }

    costs = nextCosts;
    parents.push(parent);
  }

  let cursor = 0;
  for (let j = 1; j < costs.length; j += 1) if (costs[j] < costs[cursor]) cursor = j;

  const path: Position[][] = chords.map(() => []);
  for (let step = playable.length - 1; step >= 0; step -= 1) {
    path[playable[step].index] = playable[step].set[cursor].voicing;
    if (step > 0) cursor = parents[step - 1][cursor];
  }

  return { path, unreachable };
}

/** Backwards-compatible wrapper: empty array when nothing is playable. */
export function optimize(chords: Chord[], from: number, to: number): Position[][] {
  const { path, unreachable } = optimizePath(chords, from, to);
  return unreachable.length === chords.length ? [] : path;
}
