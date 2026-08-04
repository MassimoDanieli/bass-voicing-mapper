import { describe, expect, it } from "vitest";
import { BACKING_STYLES, backingEvents, compVoicing } from "./backing";
import { parseChord, parseSong } from "./music";

const pitchClasses = (notes: number[]) => notes.map((note) => note % 12).sort((a, b) => a - b);

describe("compVoicing", () => {
  it("leaves the root to the bass player", () => {
    const f7 = parseChord("F7")!;
    const notes = compVoicing(f7);
    expect(pitchClasses(notes)).not.toContain(5); // F
    expect(pitchClasses(notes)).toContain(9); // A, the third
    expect(pitchClasses(notes)).toContain(3); // E flat, the seventh
  });

  it("drops the fifth before the guide tones when a chord is crowded", () => {
    const c13 = parseChord("C13")!;
    const notes = compVoicing(c13);
    expect(notes.length).toBeLessThanOrEqual(4);
    expect(pitchClasses(notes)).toContain(4); // third
    expect(pitchClasses(notes)).toContain(10); // seventh
    expect(pitchClasses(notes)).not.toContain(7); // fifth is the one to lose
  });

  it("stays in the piano's middle register, clear of the bass", () => {
    for (const symbol of ["Cmaj7", "F#m7b5", "Bb13", "Eaug", "Am7"]) {
      for (const note of compVoicing(parseChord(symbol)!)) {
        expect(note, symbol).toBeGreaterThanOrEqual(52);
        expect(note, symbol).toBeLessThanOrEqual(76);
      }
    }
  });

  it("voice-leads: the next chord lands near the last one", () => {
    const first = compVoicing(parseChord("Cm7")!);
    const second = compVoicing(parseChord("F7")!, first);
    const centre = (notes: number[]) => notes.reduce((t, n) => t + n, 0) / notes.length;
    expect(Math.abs(centre(second) - centre(first))).toBeLessThan(6);
  });

  it("returns nothing playable for a chord with only a root", () => {
    // A power chord has nothing left once the root goes; better silent than wrong.
    expect(pitchClasses(compVoicing(parseChord("C5")!))).toEqual([7]);
  });
});

describe("backingEvents", () => {
  const steps = parseSong("Cm7:4 F7:4 Bbmaj7:8", 4).steps;

  it("produces nothing for an empty progression", () => {
    expect(backingEvents([], "swing")).toEqual([]);
  });

  it("covers the whole progression and never runs past the end", () => {
    for (const style of BACKING_STYLES) {
      const events = backingEvents(steps, style);
      expect(events.length, style).toBeGreaterThan(0);
      expect(Math.min(...events.map((event) => event.beat)), style).toBe(0);
      expect(Math.max(...events.map((event) => event.beat)), style).toBeLessThan(16);
    }
  });

  it("is sorted, so a scheduler can walk it in one pass", () => {
    for (const style of BACKING_STYLES) {
      const beats = backingEvents(steps, style).map((event) => event.beat);
      expect([...beats].sort((a, b) => a - b), style).toEqual(beats);
    }
  });

  it("comps on every chord change, including one that falls mid-bar", () => {
    const midBar = parseSong("Cm7:2 F7:2 Bbmaj7:4", 4).steps;
    const comps = backingEvents(midBar, "straight").filter((event) => event.type === "comp");
    for (const start of [0, 2, 4]) {
      expect(comps.some((event) => event.beat === start), `beat ${start}`).toBe(true);
    }
  });

  it("swings the off-beats rather than placing them on the eighth", () => {
    const events = backingEvents(steps, "swing");
    expect(events.some((event) => Math.abs(event.beat - 1.5) < 1e-9)).toBe(false);
    expect(events.some((event) => Math.abs(event.beat - (1 + 2 / 3)) < 1e-9)).toBe(true);
  });

  it("plays the chord that is actually sounding at each hit", () => {
    const comps = backingEvents(steps, "straight").filter((event) => event.type === "comp");
    const atBeatSix = comps.filter((event) => event.beat <= 6).at(-1)!;
    // Beat 6 is inside F7: the third is A, the seventh E flat.
    expect(pitchClasses(atBeatSix.notes)).toContain(9);
    expect(pitchClasses(atBeatSix.notes)).toContain(3);
  });

  it("keeps the drums out of the way of nothing: every style has a pulse on beat one", () => {
    for (const style of BACKING_STYLES) {
      const first = backingEvents(steps, style).filter((event) => event.beat === 0);
      expect(first.some((event) => event.type === "drum"), style).toBe(true);
    }
  });
});
