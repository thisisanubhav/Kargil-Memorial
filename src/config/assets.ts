/**
 * Central registry of every static asset the experience can request.
 * This is the single source of truth: loaders, progress UI and later
 * milestones all reference assets by these typed keys — never by path.
 */
export interface AssetDescriptor {
  readonly url: string;
  /** Human-readable name shown in the loading UI. */
  readonly label: string;
  /**
   * Approximate download size in MB. Only a hint used to weight the
   * aggregate progress bar; loading is correct even if it drifts.
   */
  readonly sizeHintMb: number;
}

export const MODEL_REGISTRY = {
  terrain: { url: '/models/terrain.glb', label: 'the valley', sizeHintMb: 3.5 },
  rocks: { url: '/models/rocks.glb', label: 'the ridgeline', sizeHintMb: 8.5 },
  trees: { url: '/models/trees.glb', label: 'the pines', sizeHintMb: 2.5 },
  moon: { url: '/models/moon.glb', label: 'the night sky', sizeHintMb: 0.9 },
} as const satisfies Record<string, AssetDescriptor>;

export const AUDIO_REGISTRY = {
  wind: { url: '/audio/wind.mp3', label: 'mountain wind', sizeHintMb: 0.6 },
  snow: { url: '/audio/snow.m4a', label: 'falling snow', sizeHintMb: 4.2 },
  footsteps: { url: '/audio/footsteps.mp3', label: 'footsteps', sizeHintMb: 0.2 },
} as const satisfies Record<string, AssetDescriptor>;

export type ModelKey = keyof typeof MODEL_REGISTRY;
export type AudioKey = keyof typeof AUDIO_REGISTRY;

export const MODEL_KEYS = Object.keys(MODEL_REGISTRY) as readonly ModelKey[];
export const AUDIO_KEYS = Object.keys(AUDIO_REGISTRY) as readonly AudioKey[];
