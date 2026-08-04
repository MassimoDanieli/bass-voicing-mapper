import type { SongStep } from "./music";

export type BeatGrid = {
  /** Cumulative beat position at which each step begins. */
  starts: number[];
  total: number;
};

export type Location = {
  index: number;
  beatInStep: number;
};

export function beatGrid(steps: SongStep[]): BeatGrid {
  const starts: number[] = [];
  let total = 0;
  for (const step of steps) {
    starts.push(total);
    total += step.beats;
  }
  return { starts, total };
}

/** Musical position of a track time, in beats from the first downbeat. */
export const beatAtTime = (time: number, bpm: number, offset: number) =>
  (time - offset) * bpm / 60;

/** Track time of a beat position. Inverse of beatAtTime. */
export const timeOfBeat = (beat: number, bpm: number, offset: number) =>
  offset + beat * 60 / bpm;

export const stepStartBeat = (grid: BeatGrid, index: number) => grid.starts[index] ?? 0;

export const stepStartTime = (grid: BeatGrid, index: number, bpm: number, offset: number) =>
  timeOfBeat(stepStartBeat(grid, index), bpm, offset);

/** First beat after the given step: where an A–B loop wraps. */
export const stepEndBeat = (grid: BeatGrid, steps: SongStep[], index: number) =>
  stepStartBeat(grid, index) + (steps[index]?.beats ?? 0);

/**
 * Which chord is sounding at a beat position.
 * Returns null before the first downbeat and after the last beat, so a track
 * with an intro before the form starts does not light up the wrong chord.
 */
export function locate(grid: BeatGrid, beatPosition: number): Location | null {
  if (!grid.starts.length || !(beatPosition >= 0) || beatPosition >= grid.total) return null;

  let low = 0;
  let high = grid.starts.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (grid.starts[middle] <= beatPosition) low = middle;
    else high = middle - 1;
  }

  return { index: low, beatInStep: Math.floor(beatPosition - grid.starts[low]) };
}
