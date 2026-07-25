/**
 * The summit memorial: proportions, placement and lighting. Everything is
 * constructed procedurally from these numbers — no external assets.
 * The architecture is deliberately simple and civic: a platform, stairs,
 * the flag, a flame, a wall. Nothing martial.
 */
export interface MemorialConfig {
  /** Platform centre on the knoll (X, Z); height comes from the terrain. */
  readonly center: readonly [number, number];
  /** World bearing (radians) from the centre toward the visitor approach. */
  readonly approachBearing: number;
  readonly platform: {
    readonly lowerRadius: number;
    readonly lowerTop: number;
    readonly upperRadius: number;
    readonly upperHeight: number;
    /** How far the lower drum sinks below the local ground. */
    readonly sink: number;
  };
  readonly stairs: {
    readonly width: number;
    readonly rise: number;
    readonly run: number;
    readonly maxSteps: number;
  };
  readonly pole: {
    readonly height: number;
    readonly radiusBottom: number;
    readonly radiusTop: number;
  };
  readonly flag: {
    readonly width: number;
    readonly height: number;
    /** Cloth drop below the pole top. */
    readonly dropFromTop: number;
    readonly waveStrength: number;
  };
  readonly wall: {
    readonly innerRadius: number;
    readonly thickness: number;
    readonly height: number;
    readonly arcDegrees: number;
  };
  readonly plaque: {
    readonly width: number;
    readonly height: number;
  };
  readonly stones: {
    readonly slab: { readonly width: number; readonly height: number; readonly depth: number };
    readonly base: { readonly width: number; readonly height: number; readonly depth: number };
    readonly tilt: number;
    readonly obstacleRadius: number;
  };
  /** Ring of stones on the platform for entries located at the summit. */
  readonly summitStones: {
    readonly radius: number;
    readonly arcDegrees: number;
    /** Clear arc on the wall's axis so the inscription stays visible. */
    readonly centerGapDegrees: number;
  };
  /** The engraved dedication tablet standing behind the flag pole. */
  readonly dedication: {
    readonly distanceBehindPole: number;
    readonly width: number;
    readonly height: number;
    readonly tilt: number;
  };
  readonly flame: {
    readonly distanceFromPole: number;
    readonly light: {
      readonly color: number;
      readonly intensity: number;
      readonly distance: number;
      /** Fractional intensity flicker depth. */
      readonly flicker: number;
    };
  };
  readonly flagLight: {
    readonly color: number;
    readonly intensity: number;
    readonly distance: number;
    readonly angle: number;
    readonly penumbra: number;
  };
}

export const memorialConfig: MemorialConfig = {
  center: [-12, -24],
  // Bearing from the platform centre toward the open eastern basin — the
  // one approach with continuously walkable ground (the direct line to
  // the spawn is cut by a rock spur and a crag band).
  approachBearing: Math.atan2(14, 16),
  platform: {
    lowerRadius: 6.5,
    lowerTop: 0.55,
    upperRadius: 5.6,
    upperHeight: 0.22,
    sink: 0.5,
  },
  // A long ceremonial stairway: the platform is founded high on the
  // knoll while the walkable approach lies in the eastern basin, so the
  // ascent is genuinely earned — step by step.
  stairs: {
    width: 3.4,
    rise: 0.17,
    run: 0.46,
    maxSteps: 84,
  },
  pole: {
    height: 15,
    radiusBottom: 0.11,
    radiusTop: 0.06,
  },
  flag: {
    width: 3.6,
    height: 2.4,
    dropFromTop: 1.35,
    waveStrength: 0.26,
  },
  wall: {
    innerRadius: 5.55,
    thickness: 0.45,
    height: 1.5,
    arcDegrees: 130,
  },
  plaque: {
    width: 2.2,
    height: 0.9,
  },
  stones: {
    slab: { width: 1.05, height: 1.45, depth: 0.16 },
    base: { width: 1.25, height: 0.12, depth: 0.36 },
    tilt: -0.07,
    obstacleRadius: 0.55,
  },
  summitStones: {
    radius: 5.0,
    arcDegrees: 164,
    centerGapDegrees: 28,
  },
  dedication: {
    distanceBehindPole: 2.9,
    width: 2.7,
    height: 1.3,
    tilt: -0.16,
  },
  flame: {
    distanceFromPole: 3.4,
    light: {
      color: 0xff9440,
      intensity: 22,
      distance: 18,
      flicker: 0.16,
    },
  },
  flagLight: {
    color: 0xffe8c4,
    intensity: 100,
    distance: 48,
    angle: Math.PI / 6,
    penumbra: 0.6,
  },
};
