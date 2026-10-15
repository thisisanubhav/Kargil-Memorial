/**
 * Audio mix tuning. Volumes are pre-master gains in 0–1; fades are
 * exponential time constants in seconds — larger means slower, softer.
 */
export interface AudioConfig {
  readonly master: {
    /** Slow overall fade-in once the visitor first interacts. */
    readonly fadeTau: number;
  };
  readonly wind: {
    readonly baseVolume: number;
    /** Extra wind volume gained with altitude (exposed ground is louder). */
    readonly altitudeBoost: number;
    readonly fadeTau: number;
  };
  readonly snow: {
    readonly baseVolume: number;
    readonly fadeTau: number;
  };
  readonly music: {
    /** Kept beneath the environmental ambience so the memorial stays contemplative. */
    readonly volume: number;
    /** Seconds each harmony is allowed to breathe before the next arrives. */
    readonly chordDuration: number;
    /** Low-pass cutoff keeps the synthesized pad warm and distant. */
    readonly filterFrequency: number;
    readonly harmonies: readonly (readonly number[])[];
  };
  readonly footsteps: {
    readonly volume: number;
    readonly fadeInTau: number;
    readonly fadeOutTau: number;
    /** Playback rate range mapped to walking speed. */
    readonly minRate: number;
    readonly maxRate: number;
    /** Speed (m/s) below which footsteps are silent. */
    readonly speedThreshold: number;
  };
  /** Ground heights mapped to the 0–1 altitude blend. */
  readonly altitude: {
    readonly low: number;
    readonly high: number;
  };
}

export const audioConfig: AudioConfig = {
  master: { fadeTau: 1.6 },
  wind: { baseVolume: 0.4, altitudeBoost: 0.25, fadeTau: 0.9 },
  snow: { baseVolume: 0.3, fadeTau: 0.9 },
  music: {
    volume: 0.075,
    chordDuration: 14,
    filterFrequency: 720,
    // D minor → B-flat → F → C, voiced as a slow, unresolved remembrance theme.
    harmonies: [
      [73.42, 110, 146.83, 220],
      [58.27, 116.54, 146.83, 233.08],
      [87.31, 130.81, 174.61, 261.63],
      [65.41, 98, 130.81, 196],
    ],
  },
  footsteps: {
    volume: 0.55,
    fadeInTau: 0.12,
    fadeOutTau: 0.3,
    minRate: 0.85,
    maxRate: 1.12,
    speedThreshold: 0.15,
  },
  altitude: { low: -15, high: -5 },
};
