import * as THREE from 'three';
import type { CameraConfig } from '@/config/types';
import type { ViewportSize } from './ResizeManager';

/**
 * Owns the primary perspective camera. Later milestones layer cinematic
 * camera behaviour on top of this manager rather than replacing it.
 */
export class CameraManager {
  readonly camera: THREE.PerspectiveCamera;

  constructor(config: CameraConfig, initialSize: ViewportSize) {
    this.camera = new THREE.PerspectiveCamera(
      config.fov,
      initialSize.width / initialSize.height,
      config.near,
      config.far,
    );
    this.camera.position.set(...config.initialPosition);
    this.camera.lookAt(...config.lookAt);
  }

  setAspect({ width, height }: ViewportSize): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.camera.removeFromParent();
  }
}
