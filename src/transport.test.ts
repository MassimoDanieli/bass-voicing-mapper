import { describe, expect, it } from "vitest";
import { parseSong } from "./music";
import {
  beatAtTime,
  beatGrid,
  locate,
  stepEndBeat,
  stepStartTime,
  timeOfBeat,
} from "./transport";

const steps = parseSong("Am7:4 D7:2 Gmaj7:8", 4).steps;
const grid = beatGrid(steps);

describe("beatGrid", () => {
  it("accumulates the start of each step", () => {
    expect(grid.starts).toEqual([0, 4, 6]);
    expect(grid.total).toBe(14);
  });

  it("handles an empty progression", () => {
    expect(beatGrid([])).toEqual({ starts: [], total: 0 });
  });
});

describe("time and beat conversion", () => {
  it("round-trips through the offset", () => {
    for (const beat of [0, 1, 7.5, 13]) {
      expect(beatAtTime(timeOfBeat(beat, 120, 2.35), 120, 2.35)).toBeCloseTo(beat);
    }
  });

  it("puts the first downbeat at the offset", () => {
    expect(stepStartTime(grid, 0, 120, 2.35)).toBeCloseTo(2.35);
    // Step 1 starts on beat 4; at 120 BPM that is 2s after the downbeat.
    expect(stepStartTime(grid, 1, 120, 2.35)).toBeCloseTo(4.35);
  });

  it("is independent of playback rate: currentTime is track time", () => {
    // Slowing the track down does not move where beat 4 lives in the file.
    expect(stepStartTime(grid, 1, 120, 0)).toBeCloseTo(2);
  });
});

describe("locate", () => {
  it("finds the chord sounding at a beat position", () => {
    expect(locate(grid, 0)).toEqual({ index: 0, beatInStep: 0 });
    expect(locate(grid, 3.9)).toEqual({ index: 0, beatInStep: 3 });
    expect(locate(grid, 4)).toEqual({ index: 1, beatInStep: 0 });
    expect(locate(grid, 5.2)).toEqual({ index: 1, beatInStep: 1 });
    expect(locate(grid, 6)).toEqual({ index: 2, beatInStep: 0 });
    expect(locate(grid, 13.99)).toEqual({ index: 2, beatInStep: 7 });
  });

  it("returns null outside the form", () => {
    // Intro before the first downbeat, and anything past the last beat.
    expect(locate(grid, -0.5)).toBeNull();
    expect(locate(grid, 14)).toBeNull();
    expect(locate(grid, Number.NaN)).toBeNull();
    expect(locate(beatGrid([]), 0)).toBeNull();
  });

  it("agrees with the grid at every step boundary", () => {
    steps.forEach((_, index) => {
      expect(locate(grid, grid.starts[index])).toEqual({ index, beatInStep: 0 });
    });
  });
});

describe("loop bounds", () => {
  it("wraps after the last beat of the closing step", () => {
    expect(stepEndBeat(grid, steps, 0)).toBe(4);
    expect(stepEndBeat(grid, steps, 2)).toBe(14);
    expect(locate(grid, stepEndBeat(grid, steps, 2))).toBeNull();
  });
});
