import type { AudioListener } from 'three';
import type { AudioConfig } from '@/config/audio';

type MusicConfig = AudioConfig['music'];

interface ScoreVoice {
  readonly oscillator: OscillatorNode;
  readonly gain: GainNode;
}

const VOICE_LEVELS = [0.42, 0.18, 0.13, 0.08] as const;

/** Frame-rate-independent exponential approach. */
function damp(current: number, target: number, tau: number, delta: number): number {
  return target + (current - target) * Math.exp(-delta / tau);
}

/**
 * A restrained, generative remembrance theme made entirely with Web Audio.
 * Slow chord changes and a breathing low-pass filter create musical movement
 * without adding a licensed recording or another large asset to the download.
 */
export class AmbientScore {
  private readonly context: AudioContext;
  private readonly config: MusicConfig;
  private readonly output: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly voices: ScoreVoice[];
  private readonly filterLfo: OscillatorNode;
  private readonly filterLfoDepth: GainNode;

  private harmonyIndex = 0;
  private harmonyElapsed = 0;
  private currentVolume = 0;
  private started = false;

  constructor(listener: AudioListener, config: MusicConfig) {
    this.context = listener.context;
    this.config = config;

    this.output = this.context.createGain();
    this.output.gain.value = 0;

    this.filter = this.context.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = config.filterFrequency;
    this.filter.Q.value = 0.7;
    this.output.connect(this.filter);
    this.filter.connect(listener.getInput());

    const firstHarmony = config.harmonies[0] ?? [];
    this.voices = firstHarmony.map((frequency, index) => {
      const oscillator = this.context.createOscillator();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;

      const gain = this.context.createGain();
      gain.gain.value = VOICE_LEVELS[index] ?? 0.06;
      oscillator.connect(gain);
      gain.connect(this.output);
      return { oscillator, gain };
    });

    this.filterLfo = this.context.createOscillator();
    this.filterLfo.type = 'sine';
    this.filterLfo.frequency.value = 0.055;
    this.filterLfoDepth = this.context.createGain();
    this.filterLfoDepth.gain.value = config.filterFrequency * 0.16;
    this.filterLfo.connect(this.filterLfoDepth);
    this.filterLfoDepth.connect(this.filter.frequency);
  }

  start(): void {
    if (this.started || this.voices.length === 0) return;
    this.started = true;
    this.voices.forEach(({ oscillator }) => oscillator.start());
    this.filterLfo.start();
  }

  update(delta: number, masterGain: number): void {
    if (!this.started) return;

    this.harmonyElapsed += delta;
    if (this.harmonyElapsed >= this.config.chordDuration) {
      this.harmonyElapsed %= this.config.chordDuration;
      this.harmonyIndex = (this.harmonyIndex + 1) % this.config.harmonies.length;
      this.transitionTo(this.config.harmonies[this.harmonyIndex]!);
    }

    this.currentVolume = damp(this.currentVolume, this.config.volume * masterGain, 2.8, delta);
    this.output.gain.value = this.currentVolume;
  }

  private transitionTo(harmony: readonly number[]): void {
    const now = this.context.currentTime;
    this.voices.forEach(({ oscillator }, index) => {
      const frequency = harmony[index];
      if (frequency === undefined) return;
      oscillator.frequency.cancelScheduledValues(now);
      oscillator.frequency.setTargetAtTime(frequency, now, 2.4);
    });
  }

  dispose(): void {
    if (this.started) {
      this.voices.forEach(({ oscillator }) => oscillator.stop());
      this.filterLfo.stop();
    }
    this.voices.forEach(({ oscillator, gain }) => {
      oscillator.disconnect();
      gain.disconnect();
    });
    this.filterLfo.disconnect();
    this.filterLfoDepth.disconnect();
    this.output.disconnect();
    this.filter.disconnect();
  }
}
