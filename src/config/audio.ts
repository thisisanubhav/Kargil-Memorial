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
