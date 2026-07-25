export interface RendererConfig {
  antialias: boolean;
  maxPixelRatio: number;
  toneMappingExposure: number;
  shadows: boolean;
}

export interface CameraConfig {
  fov: number;
  near: number;
  far: number;
  initialPosition: readonly [number, number, number];
  lookAt: readonly [number, number, number];
}

export interface SceneConfig {
  backgroundColor: number;
}

export interface LoopConfig {
  /** Upper bound for a single frame's delta time in seconds. */
  maxDelta: number;
}

export interface DebugConfig {
  enabled: boolean;
  showHelpers: boolean;
  logging: boolean;
}

export interface AppConfig {
  renderer: RendererConfig;
  camera: CameraConfig;
  scene: SceneConfig;
  loop: LoopConfig;
  debug: DebugConfig;
}
