import * as THREE from 'three';
import type { DebugConfig, SceneConfig } from '@/config/types';
import { deepDispose } from '@/utils/dispose';

/**
 * Owns the root scene graph. Content added in later milestones goes through
 * this manager so it can be tracked and disposed as a unit.
 */
export class SceneManager {
  readonly scene: THREE.Scene;
  private readonly helpers = new THREE.Group();

  constructor(config: SceneConfig, debug: DebugConfig) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(config.backgroundColor);

    if (debug.showHelpers) {
      this.helpers.name = 'debug-helpers';
      this.helpers.add(new THREE.GridHelper(20, 20, 0x334455, 0x1a2230));
      this.helpers.add(new THREE.AxesHelper(2));
      this.scene.add(this.helpers);
    }
  }

  add(...objects: THREE.Object3D[]): void {
    this.scene.add(...objects);
  }

  remove(...objects: THREE.Object3D[]): void {
    this.scene.remove(...objects);
  }

  dispose(): void {
    // Deliberate backstop: owners (World, AssetManager, Memorial) dispose
    // their own resources first; this sweep catches anything orphaned.
    // Double-dispose is safe — three.js dispose() is idempotent.
    deepDispose(this.scene);
    this.scene.clear();
  }
}
