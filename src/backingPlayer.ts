import type { BackingEvent, DrumKind } from "./backing";

/** How far ahead events are queued, and how often we top the queue up. */
const LOOKAHEAD_SECONDS = 0.25;
const TICK_MS = 25;
/** Small lead-in so the first hit is scheduled rather than fired late. */
const START_LEAD = 0.08;

function noiseBuffer(context: AudioContext) {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  return buffer;
}

/**
 * Plays a generated drums-and-piano backing.
 *
 * Timing comes from the AudioContext clock, not from setInterval: events are
 * queued ahead of time with exact start times, so a busy main thread delays the
 * queueing and never the sound.
 */
export class BackingPlayer {
  private context: AudioContext;
  private drums: GainNode;
  private comp: GainNode;
  private noise: AudioBuffer;
  private timer = 0;

  private events: BackingEvent[] = [];
  private cycleBeats = 0;
  private bpm = 100;
  /** Context time at which beat 0 of the current cycle sounds. */
  private anchor = 0;
  private cursorBeats = 0;

  constructor(context: AudioContext) {
    this.context = context;
    this.noise = noiseBuffer(context);
    this.drums = context.createGain();
    this.comp = context.createGain();
    this.drums.gain.value = 0.9;
    this.comp.gain.value = 0.55;
    this.drums.connect(context.destination);
    this.comp.connect(context.destination);
  }

  setLevels(drums: number, comp: number) {
    this.drums.gain.value = drums;
    this.comp.gain.value = comp;
  }

  get playing() {
    return this.timer !== 0;
  }

  /** Beats since the cycle began, wrapped. Negative during the lead-in. */
  position(): number {
    if (!this.cycleBeats) return 0;
    const elapsed = (this.context.currentTime - this.anchor) * this.bpm / 60;
    if (elapsed < 0) return elapsed;
    return elapsed % this.cycleBeats;
  }

  start(events: BackingEvent[], bpm: number, cycleBeats: number, fromBeat = 0) {
    this.stop();
    if (!events.length || cycleBeats <= 0) return;

    this.events = events;
    this.bpm = bpm;
    this.cycleBeats = cycleBeats;
    this.cursorBeats = fromBeat;
    this.anchor = this.context.currentTime + START_LEAD - (fromBeat * 60) / bpm;

    this.schedule();
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
  }

  stop() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = 0;
  }

  dispose() {
    this.stop();
    this.drums.disconnect();
    this.comp.disconnect();
  }

  private schedule() {
    const horizon = this.context.currentTime + LOOKAHEAD_SECONDS;
    const beatsPerSecond = this.bpm / 60;

    while (this.anchor + this.cursorBeats / beatsPerSecond < horizon) {
      const cycle = Math.floor(this.cursorBeats / this.cycleBeats);
      const withinCycle = this.cursorBeats - cycle * this.cycleBeats;

      const next = this.events.find((event) => event.beat >= withinCycle - 1e-9);
      const targetBeat = next
        ? cycle * this.cycleBeats + next.beat
        : (cycle + 1) * this.cycleBeats;
      const when = this.anchor + targetBeat / beatsPerSecond;

      if (when >= horizon) break;

      // Every event landing on this beat, not just the first.
      if (next) {
        for (const event of this.events) {
          if (Math.abs(event.beat - next.beat) > 1e-9) continue;
          if (event.type === "drum") this.drum(event.kind, when, event.gain);
          else this.chord(event.notes, when, event.gain, event.duration / beatsPerSecond);
        }
        this.cursorBeats = cycle * this.cycleBeats + next.beat + 1e-6;
      } else {
        this.cursorBeats = (cycle + 1) * this.cycleBeats;
      }
    }
  }

  private burst(when: number, duration: number, gain: number, filter: BiquadFilterNode) {
    const source = this.context.createBufferSource();
    const envelope = this.context.createGain();
    source.buffer = this.noise;
    source.loop = true;
    envelope.gain.setValueAtTime(gain, when);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.drums);
    source.start(when);
    source.stop(when + duration + 0.02);
  }

  private drum(kind: DrumKind, when: number, gain: number) {
    const context = this.context;

    if (kind === "kick") {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.frequency.setValueAtTime(135, when);
      oscillator.frequency.exponentialRampToValueAtTime(42, when + 0.11);
      envelope.gain.setValueAtTime(gain * 0.9, when);
      envelope.gain.exponentialRampToValueAtTime(0.0001, when + 0.19);
      oscillator.connect(envelope);
      envelope.connect(this.drums);
      oscillator.start(when);
      oscillator.stop(when + 0.21);
      return;
    }

    const filter = context.createBiquadFilter();
    if (kind === "snare") {
      filter.type = "bandpass";
      filter.frequency.value = 1900;
      filter.Q.value = 0.7;
      this.burst(when, 0.13, gain * 0.42, filter);
    } else if (kind === "hat") {
      filter.type = "highpass";
      filter.frequency.value = 8200;
      this.burst(when, 0.045, gain * 0.3, filter);
    } else if (kind === "ride") {
      filter.type = "bandpass";
      filter.frequency.value = 5200;
      filter.Q.value = 1.6;
      this.burst(when, 0.32, gain * 0.24, filter);
    } else {
      filter.type = "bandpass";
      filter.frequency.value = 2600;
      filter.Q.value = 3.2;
      this.burst(when, 0.035, gain * 0.5, filter);
    }
  }

  private chord(notes: number[], when: number, gain: number, duration: number) {
    const perNote = gain / Math.max(2, notes.length);

    notes.forEach((note, index) => {
      const frequency = 440 * 2 ** ((note - 69) / 12);
      // A touch of roll, so the voicing sounds struck rather than triggered.
      const at = when + index * 0.008;
      const envelope = this.context.createGain();
      const tone = this.context.createOscillator();
      const body = this.context.createOscillator();

      tone.type = "triangle";
      body.type = "sine";
      tone.frequency.value = frequency;
      body.frequency.value = frequency * 2;

      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(perNote, at + 0.012);
      envelope.gain.exponentialRampToValueAtTime(perNote * 0.28, at + 0.16);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.3, duration));

      const colour = this.context.createGain();
      colour.gain.value = 0.28;
      body.connect(colour);
      colour.connect(envelope);
      tone.connect(envelope);
      envelope.connect(this.comp);

      tone.start(at);
      body.start(at);
      tone.stop(at + Math.max(0.35, duration) + 0.05);
      body.stop(at + Math.max(0.35, duration) + 0.05);
    });
  }
}
