import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import {
  AUDIO_REGISTRY,
  MODEL_KEYS,
  MODEL_REGISTRY,
  type AssetDescriptor,
  type AudioKey,
  type ModelKey,
} from '@/config/assets';
import { deepDispose } from '@/utils/dispose';
import { withRetry } from '@/utils/retry';
import type { AppLoadingManager } from './LoadingManager';

function describeError(error: unknown): string {
  if (error instanceof ErrorEvent) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Typed facade over every external asset. Assets are addressed only by
 * registry key — URLs never leak past this class. Requests are retried
 * with backoff, deduplicated while in flight, and cached once resolved.
 */
export class AssetManager {
  private readonly gltfLoader: GLTFLoader;
  private readonly dracoLoader: DRACOLoader;
  private readonly audioLoader: THREE.AudioLoader;
  private readonly loading: AppLoadingManager;

  private readonly models = new Map<ModelKey, GLTF>();
  private readonly audioBuffers = new Map<AudioKey, AudioBuffer>();
  private readonly pending = new Map<string, Promise<unknown>>();

  constructor(loading: AppLoadingManager) {
    this.loading = loading;
    // Models ship DRACO-compressed; the decoder is served locally so the
    // experience never depends on a third-party CDN.
    this.dracoLoader = new DRACOLoader(loading.manager);
    this.dracoLoader.setDecoderPath('/draco/');
    this.gltfLoader = new GLTFLoader(loading.manager);
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
    this.audioLoader = new THREE.AudioLoader(loading.manager);
  }

  /**
   * Loads every model in the registry concurrently. Waits for all of them
   * so a failure report can name each asset that failed, not just the first.
   */
  async preloadModels(keys: readonly ModelKey[] = MODEL_KEYS): Promise<void> {
    const results = await Promise.allSettled(keys.map((key) => this.loadModel(key)));

    const failedLabels = results
      .map((result, index): string | null =>
        result.status === 'rejected' ? MODEL_REGISTRY[keys[index]!].label : null,
      )
      .filter((label): label is string => label !== null);

    if (failedLabels.length > 0) {
      throw new Error(`Failed to load: ${failedLabels.join(', ')}`);
    }
  }

  loadModel(key: ModelKey): Promise<GLTF> {
    const cached = this.models.get(key);
    if (cached) return Promise.resolve(cached);

    return this.dedupe(`model:${key}`, MODEL_REGISTRY[key], (descriptor, trackingKey) =>
      withRetry(() => this.requestGltf(descriptor.url, trackingKey)).then((gltf) => {
        this.models.set(key, gltf);
        return gltf;
      }),
    );
  }

  loadAudio(key: AudioKey): Promise<AudioBuffer> {
    const cached = this.audioBuffers.get(key);
    if (cached) return Promise.resolve(cached);

    return this.dedupe(`audio:${key}`, AUDIO_REGISTRY[key], (descriptor, trackingKey) =>
      withRetry(() => this.requestAudio(descriptor.url, trackingKey)).then((buffer) => {
        this.audioBuffers.set(key, buffer);
        return buffer;
      }),
    );
  }

  /** Returns a preloaded model; throws if it was never loaded. */
  getModel(key: ModelKey): GLTF {
    const gltf = this.models.get(key);
    if (!gltf) {
      throw new Error(`AssetManager: model "${key}" requested before it was loaded`);
    }
    return gltf;
  }

  getAudio(key: AudioKey): AudioBuffer {
    const buffer = this.audioBuffers.get(key);
    if (!buffer) {
      throw new Error(`AssetManager: audio "${key}" requested before it was loaded`);
    }
    return buffer;
  }

  hasModel(key: ModelKey): boolean {
    return this.models.has(key);
  }

  private dedupe<T>(
    trackingKey: string,
    descriptor: AssetDescriptor,
    request: (descriptor: AssetDescriptor, trackingKey: string) => Promise<T>,
  ): Promise<T> {
    const inFlight = this.pending.get(trackingKey);
    if (inFlight) return inFlight as Promise<T>;

    this.loading.track(trackingKey, descriptor.label, descriptor.sizeHintMb);

    const promise = request(descriptor, trackingKey)
      .then((asset) => {
        this.loading.markDone(trackingKey);
        return asset;
      })
      .catch((error: unknown) => {
        this.loading.markFailed(trackingKey, describeError(error));
        throw error;
      })
      .finally(() => this.pending.delete(trackingKey));

    this.pending.set(trackingKey, promise);
    return promise;
  }

  private requestGltf(url: string, trackingKey: string): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(url, resolve, (event) => this.reportBytes(trackingKey, event), reject);
    });
  }

  private requestAudio(url: string, trackingKey: string): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      this.audioLoader.load(url, resolve, (event) => this.reportBytes(trackingKey, event), reject);
    });
  }

  private reportBytes(trackingKey: string, event: ProgressEvent): void {
    if (event.total > 0) {
      this.loading.report(trackingKey, event.loaded / event.total);
    }
  }

  dispose(): void {
    for (const gltf of this.models.values()) {
      deepDispose(gltf.scene);
    }
    this.models.clear();
    this.audioBuffers.clear();
    this.pending.clear();
    this.dracoLoader.dispose();
  }
}
