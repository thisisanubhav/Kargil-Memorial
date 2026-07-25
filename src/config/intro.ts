/**
 * The cinematic introduction timeline. Times in seconds on the full
 * duration; under prefers-reduced-motion the fly-through is dropped and
 * cues are compressed proportionally.
 */
export interface IntroLineCue {
  readonly show: number;
  readonly hide: number;
}

export interface IntroConfig {
  readonly duration: number;
  readonly reducedDuration: number;
  /** When the opening black veil has fully dissolved. */
  readonly veilFadeEnd: number;
  /** Fly-through camera positions; the visitor's start pose is appended. */
  readonly positions: readonly (readonly [number, number, number])[];
  /** Matching look-at targets; the visitor's look direction is appended. */
  readonly targets: readonly (readonly [number, number, number])[];
  readonly lines: readonly IntroLineCue[];
  readonly skipHintAt: number;
}

export const introConfig: IntroConfig = {
  duration: 26,
  reducedDuration: 9,
  veilFadeEnd: 3.2,

  // Low over the south-eastern rim, INSIDE the mountains — peaks and
  // moon fill the first frame (never the tile's edges) → gliding down
  // the valley as the gaze lifts to the moon → over the basin as the
  // memorial knoll reveals → settling into the visitor's own eyes.
  positions: [
    [55, 18, 85],
    [30, 14, 48],
    [10, 2, 34],
  ],
  targets: [
    [-45, 26, -140],
    [-55, 110, -330],
    [-12, 2, -24],
  ],

  lines: [
    { show: 4.0, hide: 10.0 },
    { show: 8.5, hide: 13.5 },
    { show: 12.5, hide: 17.5 },
  ],
  skipHintAt: 2,
};
