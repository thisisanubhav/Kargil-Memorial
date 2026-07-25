/**
 * Visitor movement tuning. The pace is deliberately slow — this is a
 * place to walk through quietly, not to traverse quickly.
 */
export interface ControlsConfig {
  /** Walking speed in m/s. No sprint, no jump. */
  readonly walkSpeed: number;
  /** Time constant (s) for easing up to speed. */
  readonly accelTau: number;
  /** Time constant (s) for easing to a stop. */
  readonly decelTau: number;
  /** Time constant (s) for look smoothing. */
  readonly lookTau: number;
  readonly lookSensitivity: number;
  /** Pitch clamp in radians (up/down). */
  readonly pitchLimit: number;
  /** Camera height above the ground, in metres. */
  readonly eyeHeight: number;
  /** Time constant (s) for easing eye height over terrain steps. */
  readonly groundTau: number;
  readonly bob: {
    readonly amplitude: number;
    /** Bob phase advance per metre walked. */
    readonly frequency: number;
  };
  /** Visitor body radius for rock collision. */
  readonly bodyRadius: number;
  /** Rocks shorter than this (m) don't block walking. */
  readonly minObstacleHeight: number;
  /** Bounding boxes overestimate round boulders; shrink them a little. */
  readonly obstacleShrink: number;
  /** Steepest walkable rise/run; steeper ground blocks movement. */
  readonly maxSlope: number;
  /**
   * Distance ahead (m) at which the slope is sampled. Sampling at a
   * stride's length lets discrete stairs read as gentle slopes while
   * cliff faces stay unclimbable.
   */
  readonly slopeProbeDistance: number;
  /** Maximum distance from world origin the visitor may wander. */
  readonly walkBounds: number;
}

export const controlsConfig: ControlsConfig = {
  walkSpeed: 2.0,
  accelTau: 0.5,
  decelTau: 0.3,
  lookTau: 0.08,
  lookSensitivity: 0.0022,
  pitchLimit: 1.1,
  eyeHeight: 2.6,
  groundTau: 0.12,
  bob: {
    amplitude: 0.055,
    frequency: 4.2,
  },
  bodyRadius: 0.5,
  minObstacleHeight: 0.6,
  obstacleShrink: 0.85,
  maxSlope: 0.95,
  slopeProbeDistance: 0.45,
  walkBounds: 105,
};
