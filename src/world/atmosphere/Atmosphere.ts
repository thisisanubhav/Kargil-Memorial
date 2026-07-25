import * as THREE from 'three';
import { atmosphereConfig, type AtmosphereConfig } from '@/config/atmosphere';
import { createWindUniforms, type WindUniforms } from './wind';
import { GroundFog } from './GroundFog';
import { MoonGlow } from './MoonGlow';
import { Snowfall } from './Snowfall';

/**
 * Owns everything that makes the air feel alive: distance fog, ground
 * fog, snowfall and the moon's halo — all driven by one wind clock.
 * Respects prefers-reduced-motion by calming the wind and thinning the
 * snow rather than deadening the scene entirely.
 */
export class Atmosphere {
  readonly group = new THREE.Group();
  readonly wind: WindUniforms;
  /** 1 = full motion; reduced-motion users get a calmer scene. */
  readonly motionScale: number;

  private readonly scene: THREE.Scene;
  private readonly fog: THREE.FogExp2;
  private readonly snowfall: Snowfall;
  private readonly groundFog: GroundFog;
  private readonly moonGlow: MoonGlow;

  constructor(
    scene: THREE.Scene,
    moonPosition: THREE.Vector3,
    config: AtmosphereConfig = atmosphereConfig,
  ) {
    this.scene = scene;
    this.group.name = 'atmosphere';

    this.motionScale = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.4 : 1;
    this.wind = createWindUniforms(config.wind.direction);

    this.fog = new THREE.FogExp2(config.distanceFog.color, config.distanceFog.density);
    this.scene.fog = this.fog;

    this.snowfall = new Snowfall(config.snow, this.wind, this.motionScale);
    this.groundFog = new GroundFog(config.groundFog.color, config.groundFog.layers, this.wind);
    this.moonGlow = new MoonGlow(
      moonPosition,
      config.moonGlow.scale,
      config.moonGlow.color,
      config.moonGlow.opacity,
    );

    this.group.add(this.snowfall.points, this.groundFog.group, this.moonGlow.sprite);
  }

  update(delta: number): void {
    this.wind.uWindTime.value += delta * this.motionScale;
  }

  dispose(): void {
    if (this.scene.fog === this.fog) this.scene.fog = null;
    this.snowfall.dispose();
    this.groundFog.dispose();
    this.moonGlow.dispose();
    this.group.removeFromParent();
    this.group.clear();
  }
}
