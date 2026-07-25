/**
 * Atmosphere tuning: fog, snow, glow, bloom, grade and wind. All motion
 * derives from one shared wind clock so the scene breathes as a whole.
 */
export interface SnowConfig {
  readonly count: number;
  /** World-space box the snow lives in (wraps at the edges). */
  readonly center: readonly [number, number, number];
  readonly area: readonly [number, number, number];
  readonly fallSpeed: number;
  readonly drift: number;
  readonly size: number;
  readonly opacity: number;
  readonly color: number;
}

export interface GroundFogLayer {
  readonly height: number;
  readonly size: number;
  readonly opacity: number;
  readonly noiseScale: number;
  readonly scrollSpeed: number;
}

export interface AtmosphereConfig {
  readonly distanceFog: {
    readonly color: number;
    readonly density: number;
  };
  readonly groundFog: {
    readonly color: number;
    readonly layers: readonly GroundFogLayer[];
  };
  readonly snow: SnowConfig;
  readonly moonGlow: {
    readonly scale: number;
    readonly color: number;
    readonly opacity: number;
  };
  readonly bloom: {
    readonly strength: number;
    readonly radius: number;
    readonly threshold: number;
  };
  readonly grade: {
    readonly vignetteStrength: number;
    readonly vignetteStart: number;
    readonly vignetteEnd: number;
    /** Cool lift added to shadow regions, in linear RGB. */
    readonly shadowLift: readonly [number, number, number];
  };
  readonly wind: {
    /** Horizontal wind direction (normalized-ish), world XZ. */
    readonly direction: readonly [number, number];
    readonly treeSway: number;
  };
}

export const atmosphereConfig: AtmosphereConfig = {
  distanceFog: {
    color: 0x0b1322,
    density: 0.0045,
  },

  groundFog: {
    color: 0x9fb4d8,
    layers: [
      { height: -13.0, size: 260, opacity: 0.2, noiseScale: 3.0, scrollSpeed: 0.010 },
      { height: -10.4, size: 210, opacity: 0.14, noiseScale: 4.2, scrollSpeed: 0.016 },
    ],
  },

  snow: {
    count: 9000,
    center: [0, 2, -6],
    area: [200, 46, 200],
    fallSpeed: 1.5,
    drift: 0.9,
    size: 1.35,
    opacity: 0.45,
    color: 0xdfe8f5,
  },

  moonGlow: {
    scale: 150,
    color: 0xc9d6ef,
    opacity: 0.32,
  },

  bloom: {
    strength: 0.45,
    radius: 0.55,
    threshold: 0.72,
  },

  grade: {
    vignetteStrength: 0.34,
    vignetteStart: 0.4,
    vignetteEnd: 0.95,
    shadowLift: [0.008, 0.014, 0.028],
  },

  wind: {
    direction: [0.85, 0.35],
    treeSway: 0.14,
  },
};
