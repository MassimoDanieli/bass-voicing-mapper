import { describe, expect, it } from "vitest";
import {
  framesToSegments,
  mergeChordSegments,
  segmentsToProgression,
  type ChordSegment,
} from "./audioAnalysis";

describe("audio timeline analysis", () => {
  it("stabilizes a one-frame chord detection glitch", () => {
    const segments = framesToSegments([
      { time: 0, chord: "Am", confidence: 0.8 },
      { time: 0.5, chord: "E", confidence: 0.4 },
      { time: 1, chord: "Am", confidence: 0.82 },
      { time: 1.5, chord: "D7", confidence: 0.76 },
    ], 2, 0.5);
    expect(segments.map(segment => [segment.chord, segment.start, segment.end])).toEqual([
      ["Am", 0, 1.5],
      ["D7", 1.5, 2],
    ]);
  });

  it("merges adjacent editable timeline segments", () => {
    const segments: ChordSegment[] = [
      { id: "a", start: 0, end: 2, chord: "C", confidence: 0.8, source: "detected" },
      { id: "b", start: 2, end: 4, chord: "G7", confidence: 0.6, source: "detected" },
    ];
    const merged = mergeChordSegments(segments, 0);
    expect(merged).toHaveLength(1);
    expect({ start: merged[0].start, end: merged[0].end, source: merged[0].source }).toEqual({
      start: 0,
      end: 4,
      source: "edited",
    });
    expect(merged[0].confidence).toBeCloseTo(0.7);
  });

  it("serializes corrected segments into a timed progression", () => {
    const segments: ChordSegment[] = [
      { id: "a", start: 0, end: 2, chord: "Am7", confidence: 1, source: "edited" },
      { id: "b", start: 2, end: 3, chord: "N.C.", confidence: 0, source: "detected" },
      { id: "c", start: 3, end: 5, chord: "D7", confidence: 0.8, source: "detected" },
    ];
    expect(segmentsToProgression(segments, 120)).toBe("Am7:4 D7:4");
  });
});

