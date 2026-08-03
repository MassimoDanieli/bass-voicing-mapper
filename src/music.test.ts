import { describe, expect, it } from "vitest";
import {
  candidates,
  noteName,
  omittedTones,
  optimize,
  parseChord,
  parseProgression,
} from "./music";

describe("parseChord", () => {
  it("rejects unknown chord qualities instead of silently returning a major triad", () => {
    expect(parseChord("Cfoo")).toBeNull();
  });

  it("recognizes common aliases and Unicode accidentals", () => {
    expect(parseChord("C-7")?.quality).toBe("m7");
    expect(parseChord("CM7")?.quality).toBe("maj7");
    expect(parseChord("B♭°7")?.quality).toBe("dim7");
    expect(parseChord("F♯min7b5")?.quality).toBe("m7b5");
  });

  it("parses and validates slash-chord bass notes", () => {
    const chord = parseChord("C/E");
    expect(chord?.bass).toBe(4);
    expect(chord?.tones.map((tone) => tone.pitchClass)).toEqual([0, 4, 7]);
  });

  it("reports invalid tokens without discarding valid chords", () => {
    const result = parseProgression("Dm7 Cfoo G7");
    expect(result.chords.map((chord) => chord.raw)).toEqual(["Dm7", "G7"]);
    expect(result.invalid).toEqual(["Cfoo"]);
  });
});

describe("voicing generation", () => {
  it("keeps all tones of triads", () => {
    const chord = parseChord("Cm")!;
    expect(candidates(chord, 0, 5).every((voicing) => voicing.length === 3)).toBe(true);
  });

  it("preserves the characteristic third and seventh in the default progression", () => {
    const chords = parseProgression("C-7 F7 Bbdim7 Ebdim7").chords;
    const path = optimize(chords, 0, 5);

    expect(path).toHaveLength(chords.length);
    path.forEach((voicing, index) => {
      const omittedRoles = omittedTones(chords[index], voicing).map((tone) => tone.role);
      expect(omittedRoles).not.toContain("third");
      expect(omittedRoles).not.toContain("seventh");
    });
  });

  it("omits the fifth before characteristic tones in five-note ninth chords", () => {
    const chord = parseChord("C9")!;
    const [voicing] = optimize([chord], 0, 5);
    expect(omittedTones(chord, voicing).map((tone) => tone.role)).toEqual(["fifth"]);
  });

  it("places the requested slash note at the bottom of a slash chord", () => {
    const chord = parseChord("C/E")!;
    const [voicing] = optimize([chord], 0, 12);
    const lowest = [...voicing].sort((a, b) => a.midi - b.midi)[0];
    expect(lowest.pitchClass).toBe(chord.bass);
  });

  it("supports a non-chord slash bass", () => {
    const chord = parseChord("C/F#")!;
    const [voicing] = optimize([chord], 0, 12);
    const lowest = [...voicing].sort((a, b) => a.midi - b.midi)[0];
    expect(lowest.pitchClass).toBe(6);
  });

  it("uses flat spelling for flat-root chords", () => {
    const chord = parseChord("Bb7")!;
    expect(noteName(3, chord)).toBe("E♭");
    expect(noteName(10, chord)).toBe("B♭");
  });
});
