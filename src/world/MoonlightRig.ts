import * as THREE from 'three';
import type { HemisphereConfig, MoonlightConfig } from '@/config/world';

/**
 * The night lighting rig: one directional "moonlight" aligned with the
 * visible moon, plus a dim hemisphere for starlit sky bounce. Intensities
 * are tuned for ACES Filmic output rather than raw lux values — real
 * moonlight (~0.25 lux) would be pure black on a display; this rig keeps
 * the same single-source, cool-toned character at a viewable exposure.
 */
export class MoonlightRig {
  readonly group = new THREE.Group();

  private readonly moonLight: THREE.DirectionalLight;
  private readonly hemisphere: THREE.HemisphereLight;

  constructor(
    moonlight: MoonlightConfig,
    hemisphere: HemisphereConfig,
    moonWorldPosition: THREE.Vector3,
  ) {
    this.group.name = 'lighting';

    this.moonLight = new THREE.DirectionalLight(moonlight.color, moonlight.intensity);
    // Keep the light on the moon's bearing but close enough for a tight,
    // high-resolution shadow frustum.
    this.moonLight.position.copy(moonWorldPosition).normalize().multiplyScalar(120);
    this.moonLight.target.position.set(0, 0, 0);
    this.moonLight.castShadow = true;

    const { shadow } = moonlight;
    this.moonLight.shadow.mapSize.set(shadow.mapSize, shadow.mapSize);
    this.moonLight.shadow.camera.near = 1;
    this.moonLight.shadow.camera.far = 320;
    this.moonLight.shadow.camera.left = -shadow.area;
    this.moonLight.shadow.camera.right = shadow.area;
    this.moonLight.shadow.camera.top = shadow.area;
    this.moonLight.shadow.camera.bottom = -shadow.area;
    this.moonLight.shadow.bias = shadow.bias;
    this.moonLight.shadow.normalBias = shadow.normalBias;

    this.hemisphere = new THREE.HemisphereLight(
      hemisphere.skyColor,
      hemisphere.groundColor,
      hemisphere.intensity,
    );

    this.group.add(this.moonLight, this.moonLight.target, this.hemisphere);
  }

  dispose(): void {
    this.moonLight.shadow.map?.dispose();
    this.moonLight.dispose();
    this.hemisphere.dispose();
    this.group.removeFromParent();
  }
}
