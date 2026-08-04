import { describe, expect, it } from "vitest";
import {
  candidates,
  noteName,
  omittedTones,
  optimize,
  optimizePath,
  parseChord,
  parseProgression,
  parseSong,
  spellTone,
} from "./music";

describe("parseChord", () => {
  it("rejects unknown chord qualities instead of silently returning a major triad", () => {
    expect(parseChord("Cfoo")).toBeNull();
  });

  it("does not resolve qualities through Object.prototype", () => {
    // Regression: ALIASES was an object literal, so `Cconstructor` returned a
    // function, passed the undefined check, and threw inside a render.
    for (const symbol of ["Cconstructor", "CtoString", "C__proto__", "ChasOwnProperty", "CvalueOf"]) {
      expect(() => parseChord(symbol)).not.toThrow();
      expect(parseChord(symbol)).toBeNull();
    }
  });

  it("recognizes common aliases and Unicode accidentals", () => {
    expect(parseChord("C-7")?.quality).toBe("m7");
    expect(parseChord("CM7")?.quality).toBe("maj7");
    expect(parseChord("B♭°7")?.quality).toBe("dim7");
    expect(parseChord("F♯min7b5")?.quality).toBe("m7b5");
  });

  it("reads uppercase M as major, not as minor", () => {
    expect(parseChord("CM")?.quality).toBe("maj");
    expect(parseChord("Cm")?.quality).toBe("m");
  });

  it("covers the qualities a jazz or bossa chart actually uses", () => {
    const expected: Record<string, string> = {
      G7sus4: "7sus4", C13: "13", "G7b9": "7b9", "G7#9": "7#9", "G7alt": "alt",
      "CmMaj7": "mmaj7", "C6/9": "69", Cm11: "m11", "C7#5": "7#5", "C7b5": "7b5",
      "C5": "5", "Cm(add9)": "madd9", "C^7": "maj7", "Ch7": "m7b5",
    };
    for (const [symbol, quality] of Object.entries(expected)) {
      expect(parseChord(symbol)?.quality, symbol).toBe(quality);
    }
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

  it("treats bar lines and repeat marks as separators, not as chords", () => {
    const result = parseProgression("C | Am | F % G");
    expect(result.chords.map((chord) => chord.raw)).toEqual(["C", "Am", "F", "G"]);
    expect(result.invalid).toEqual([]);
  });
});

describe("parseSong", () => {
  it("reads per-chord durations and falls back to the default", () => {
    const { steps, invalid } = parseSong("Am7:4 D7 Gmaj7:8", 2);
    expect(steps.map((step) => [step.chord.raw, step.beats])).toEqual([
      ["Am7", 4], ["D7", 2], ["Gmaj7", 8],
    ]);
    expect(invalid).toEqual([]);
  });

  it("keeps beats whole so the transport cannot drift", () => {
    expect(parseSong("C:0", 4).steps[0].beats).toBe(1);
    expect(parseSong("C:999", 4).steps[0].beats).toBe(64);
  });
});

describe("note spelling", () => {
  it("spells chord tones from their degree", () => {
    const f7 = parseChord("F7")!;
    expect(f7.tones.map((tone) => spellTone(f7, tone))).toEqual(["F", "A", "C", "E♭"]);
    const cm7 = parseChord("Cm7")!;
    expect(cm7.tones.map((tone) => spellTone(cm7, tone))).toEqual(["C", "E♭", "G", "B♭"]);
    const fs = parseChord("F#m7")!;
    expect(fs.tones.map((tone) => spellTone(fs, tone))).toEqual(["F♯", "A", "C♯", "E"]);
  });

  it("falls back to a plain name rather than printing a double flat", () => {
    const chord = parseChord("Bbdim7")!;
    // Bb Db Fb Abb is correct on paper; on a fretboard we show G.
    expect(chord.tones.map((tone) => spellTone(chord, tone))).toEqual(["B♭", "D♭", "F♭", "G"]);
  });

  it("uses flat spelling for flat-root chords", () => {
    const chord = parseChord("Bb7")!;
    expect(noteName(3, chord)).toBe("E♭");
    expect(noteName(10, chord)).toBe("B♭");
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

  it("reports unplayable chords instead of voiding the whole path", () => {
    // Regression: one unreachable chord used to return [] for every chord.
    const chords = parseProgression("E7 C/F# A7").chords;
    const { path, unreachable } = optimizePath(chords, 0, 1);
    expect(unreachable).toEqual([1]);
    expect(path[0].length).toBeGreaterThan(0);
    expect(path[1]).toEqual([]);
    expect(path[2].length).toBeGreaterThan(0);
  });

  it("stays responsive on a long progression across the whole neck", () => {
    const chords = parseProgression("C9 F9 Bb9 Eb9 Ab9 Db9 Gb9 B9").chords;
    optimizePath(chords, 0, 24); // warm up, so the first run does not measure the JIT

    // Best of three: a single sample is noise on a loaded CI runner, and a flaky
    // performance test gets muted rather than fixed. This still catches the
    // regression it guards against, which was ~300ms.
    let best = Number.POSITIVE_INFINITY;
    for (let run = 0; run < 3; run += 1) {
      const started = performance.now();
      optimizePath(chords, 0, 24);
      best = Math.min(best, performance.now() - started);
    }
    expect(best).toBeLessThan(60);
  });
});
