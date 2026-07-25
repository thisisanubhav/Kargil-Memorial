/**
 * The summit arrival moment: timings in seconds, radii in metres.
 * Happens once, when the visitor first stands on the platform.
 */
export interface SummitConfig {
  /** XZ distance from the platform centre that counts as arrival. */
  readonly triggerRadius: number;
  /** How far below the platform surface still counts as standing on it. */
  readonly triggerHeightTolerance: number;
  /** Duration of the slow gaze transition toward the flag. */
  readonly easeDuration: number;
  /** Total length of the held moment. */
  readonly duration: number;
  /** Seconds over which the warmth blooms. */
  readonly warmthRamp: number;
  /** Grace period before a key/click may end the moment early. */
  readonly interruptGrace: number;
  readonly lines: readonly { readonly show: number; readonly hide: number }[];
  readonly warmth: {
    /** Flame point-light intensity multiplier at full warmth. */
    readonly flameBoost: number;
    /** Extra metres of flame light reach at full warmth. */
    readonly flameReach: number;
    /** Flame visual scale at full warmth. */
    readonly flameScale: number;
    /** Flag spotlight intensity multiplier at full warmth. */
    readonly spotBoost: number;
  };
}

export const summitConfig: SummitConfig = {
  triggerRadius: 5.4,
  triggerHeightTolerance: 0.8,
  easeDuration: 3.5,
  duration: 21,
  warmthRamp: 6,
  interruptGrace: 1.5,
  lines: [
    { show: 2.8, hide: 9.8 },
    { show: 10.8, hide: 19.2 },
  ],
  warmth: {
    flameBoost: 1.55,
    flameReach: 5,
    flameScale: 1.16,
    spotBoost: 1.35,
  },
};
