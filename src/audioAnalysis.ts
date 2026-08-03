export type AudioAnalysis = {
  bpm: number;
  key: string;
  progression: string;
  confidence: number;
};

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function monoSamples(buffer: AudioBuffer) {
  const length = buffer.length;
  const channels = buffer.numberOfChannels;
  const mono = new Float32Array(length);
  for (let channel = 0; channel < channels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < length; index++) mono[index] += data[index] / channels;
  }
  return mono;
}

function normalize(values: number[]) {
  const sum = values.reduce((total, value) => total + Math.max(0, value), 0) || 1;
  return values.map(value => Math.max(0, value) / sum);
}

function correlation(a: number[], b: number[]) {
  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
  let numerator = 0;
  let left = 0;
  let right = 0;
  for (let index = 0; index < a.length; index++) {
    const da = a[index] - meanA;
    const db = b[index] - meanB;
    numerator += da * db;
    left += da * da;
    right += db * db;
  }
  return numerator / Math.sqrt((left || 1) * (right || 1));
}

function rotate(profile: number[], root: number) {
  return Array.from({ length: 12 }, (_, index) => profile[(index - root + 12) % 12]);
}

function estimateKey(chroma: number[]) {
  let best = { score: -Infinity, name: "C" };
  for (let root = 0; root < 12; root++) {
    const major = correlation(chroma, rotate(MAJOR_PROFILE, root));
    if (major > best.score) best = { score: major, name: NOTE_NAMES[root] };
    const minor = correlation(chroma, rotate(MINOR_PROFILE, root));
    if (minor > best.score) best = { score: minor, name: `${NOTE_NAMES[root]}m` };
  }
  return best;
}

function estimateBpm(samples: Float32Array, sampleRate: number) {
  const hop = Math.max(256, Math.round(sampleRate / 200));
  const envelope: number[] = [];
  for (let start = 0; start < samples.length; start += hop) {
    let energy = 0;
    const end = Math.min(samples.length, start + hop);
    for (let index = start; index < end; index++) energy += samples[index] * samples[index];
    envelope.push(Math.sqrt(energy / Math.max(1, end - start)));
  }

  const novelty = envelope.map((value, index) => Math.max(0, value - (envelope[index - 1] ?? value)));
  const framesPerSecond = sampleRate / hop;
  let bestBpm = 100;
  let bestScore = -Infinity;
  for (let bpm = 55; bpm <= 190; bpm++) {
    const lag = Math.round(framesPerSecond * 60 / bpm);
    let score = 0;
    for (let index = lag; index < novelty.length; index++) score += novelty[index] * novelty[index - lag];
    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }
  return bestBpm;
}

function chromaForRange(samples: Float32Array, sampleRate: number, startSeconds: number, durationSeconds: number) {
  const start = Math.max(0, Math.floor(startSeconds * sampleRate));
  const end = Math.min(samples.length, Math.floor((startSeconds + durationSeconds) * sampleRate));
  const output = Array(12).fill(0) as number[];
  if (end <= start) return output;

  const frequencies: { pitch: number; frequency: number }[] = [];
  for (let midi = 36; midi <= 83; midi++) {
    frequencies.push({ pitch: midi % 12, frequency: 440 * Math.pow(2, (midi - 69) / 12) });
  }

  const stride = Math.max(1, Math.floor(sampleRate / 11025));
  for (const { pitch, frequency } of frequencies) {
    const omega = 2 * Math.PI * frequency / sampleRate;
    const coefficient = 2 * Math.cos(omega * stride);
    let previous = 0;
    let previous2 = 0;
    for (let index = start; index < end; index += stride) {
      const next = samples[index] + coefficient * previous - previous2;
      previous2 = previous;
      previous = next;
    }
    const power = previous2 * previous2 + previous * previous - coefficient * previous * previous2;
    output[pitch] += Math.max(0, power);
  }
  return normalize(output.map(value => Math.log1p(value)));
}

function chordFromChroma(chroma: number[]) {
  let best = { score: -Infinity, chord: "C" };
  for (let root = 0; root < 12; root++) {
    const majorTones = [root, (root + 4) % 12, (root + 7) % 12];
    const minorTones = [root, (root + 3) % 12, (root + 7) % 12];
    const majorScore = majorTones.reduce((sum, tone) => sum + chroma[tone], 0) - chroma.reduce((sum, value, index) => sum + (majorTones.includes(index) ? 0 : value * 0.22), 0);
    const minorScore = minorTones.reduce((sum, tone) => sum + chroma[tone], 0) - chroma.reduce((sum, value, index) => sum + (minorTones.includes(index) ? 0 : value * 0.22), 0);
    if (majorScore > best.score) best = { score: majorScore, chord: NOTE_NAMES[root] };
    if (minorScore > best.score) best = { score: minorScore, chord: `${NOTE_NAMES[root]}m` };
  }
  return best;
}

export async function analyzeAudioFile(file: File): Promise<AudioAnalysis> {
  const context = new AudioContext();
  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    const samples = monoSamples(decoded);
    const duration = decoded.duration;
    const bpm = estimateBpm(samples, decoded.sampleRate);
    const fullChroma = chromaForRange(samples, decoded.sampleRate, 0, Math.min(duration, 90));
    const keyResult = estimateKey(fullChroma);

    const segmentDuration = Math.max(2.5, Math.min(6, 240 / Math.max(60, bpm)));
    const maxSegments = 24;
    const usableDuration = Math.min(duration, segmentDuration * maxSegments);
    const chords: string[] = [];
    const scores: number[] = [];
    for (let start = 0; start < usableDuration; start += segmentDuration) {
      const result = chordFromChroma(chromaForRange(samples, decoded.sampleRate, start, segmentDuration));
      if (chords.at(-1) !== result.chord) chords.push(result.chord);
      scores.push(result.score);
    }

    const confidence = Math.max(0, Math.min(1, (keyResult.score + scores.reduce((sum, value) => sum + value, 0) / Math.max(1, scores.length)) / 2));
    return {
      bpm,
      key: keyResult.name,
      progression: chords.join(" "),
      confidence,
    };
  } finally {
    await context.close();
  }
}
