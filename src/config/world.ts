/**
 * Declarative placement and lighting for the Himalayan night environment.
 * All positions are in metres. Vertical placement is resolved at build
 * time by raycasting against the terrain, so nothing here depends on the
 * terrain's internal geometry — only on where things should stand.
 */
export type GroundSnapMode =
  /** Trust the configured Y exactly. */
  | 'none'
  /** Put the object's origin on the terrain surface (for assets authored with roots below origin). */
  | 'origin'
  /** Put the object's bounding-box bottom on the terrain surface. */
  | 'bottom';

export interface PlacementConfig {
  readonly position: readonly [number, number, number];
  readonly rotationY?: number;
  readonly scale?: number | readonly [number, number, number];
  readonly snap?: GroundSnapMode;
  /** Extra Y applied after snapping (negative sinks the object). */
  readonly groundOffset?: number;
  /**
   * Snap each direct child to the terrain individually instead of the
   * whole object at once — for pre-scattered assets (a boulder field)
   * whose pieces must each follow the slope.
   */
  readonly snapChildren?: boolean;
}

export interface MoonlightConfig {
  readonly color: number;
  readonly intensity: number;
  readonly shadow: {
    readonly mapSize: number;
    /** Half-extent of the ortho shadow frustum around the focal area. */
    readonly area: number;
    readonly bias: number;
    readonly normalBias: number;
  };
}

export interface HemisphereConfig {
  readonly skyColor: number;
  readonly groundColor: number;
  readonly intensity: number;
}


export interface WorldConfig {
  readonly terrain: PlacementConfig;
  readonly moon: PlacementConfig;
  readonly rocks: PlacementConfig;
  readonly treeClusters: readonly PlacementConfig[];
  readonly lighting: {
    readonly moonlight: MoonlightConfig;
    readonly hemisphere: HemisphereConfig;
  };
  readonly view: {
    /** Where the observer stands (X, Z); height is ground + eyeHeight. */
    readonly standpoint: readonly [number, number];
    readonly eyeHeight: number;
    /** What the observer faces (X, Z); height is ground + lookAtHeight. */
    readonly lookAt: readonly [number, number];
    readonly lookAtHeight: number;
  };
}

export const worldConfig: WorldConfig = {
  // 1 m source tile scaled into a ~240 m valley floor; Y slightly
  // exaggerated for Himalayan relief (~40 m).
  terrain: {
    position: [0, 0, 0],
    scale: [240, 260, 240],
    snap: 'none',
  },

  // Source sphere is ~1,110 m across; scaled to ~50 m and placed ~600 m
  // out so it reads as a large cinematic moon low over the ridgeline —
  // offset from the memorial's bearing so the raised flag never covers it.
  moon: {
    position: [-40, 260, -520],
    scale: 0.045,
    snap: 'none',
  },

  // Pre-scattered boulder field; every boulder follows the slope
  // individually, sunk slightly so it sits into the ground.
  rocks: {
    position: [2, 0, 2],
    scale: 2.4,
    snapChildren: true,
    groundOffset: -0.5,
  },

  // The tree asset is a pre-arranged pine cluster (roots below origin,
  // so snap mode is 'origin'). Clusters are cloned and share GPU
  // resources with the cached asset.
  treeClusters: [
    { position: [-40, 0, -42], rotationY: 0.6, scale: 1.4, snap: 'origin' },
    { position: [32, 0, -44], rotationY: 2.4, scale: 1.2, snap: 'origin' },
    { position: [-46, 0, 12], rotationY: 4.0, scale: 1.5, snap: 'origin' },
    { position: [46, 0, -8], rotationY: 1.2, scale: 1.1, snap: 'origin' },
  ],

  lighting: {
    moonlight: {
      color: 0xa9bfe3,
      intensity: 2.2,
      shadow: {
        mapSize: 2048,
        area: 80,
        bias: -0.0005,
        normalBias: 0.8,
      },
    },
    hemisphere: {
      skyColor: 0x27344c,
      groundColor: 0x10131a,
      intensity: 1.1,
    },
  },

  // Low and close enough that the flag crests the skyline: from here the
  // knoll rises ~15° while the far ridge subtends ~11°, so the Tricolour
  // reads against open sky with the moon above it.
  // eyeHeight matches controlsConfig.eyeHeight so the framed opening shot
  // and the first step of the walk are continuous.
  view: {
    standpoint: [3, 14],
    eyeHeight: 2.6,
    lookAt: [-12, -24],
    lookAtHeight: 5.5,
  },
};
