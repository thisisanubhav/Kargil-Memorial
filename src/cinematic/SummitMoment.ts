import * as THREE from 'three';
import { summitConfig, type SummitConfig } from '@/config/summit';
import type { SummitMessage } from '@/ui/SummitMessage';

const END_FADE = 0.7;

function smootherstep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * The arrival at the summit, honoured once: the visitor's position never
 * moves — only their gaze eases slowly up to the flag while warmth
 * blooms around the eternal flame and the two remembrance lines pass.
 * Any key or click (after a short grace) returns control early; when the
 * moment ends the camera is left exactly where it looks, so the handover
 * back to walking is seamless.
 */
export class SummitMoment {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly message: SummitMessage;
  private readonly onWarmth: (mix: number) => void;
  private readonly config: SummitConfig;

  private readonly startQuaternion = new THREE.Quaternion();
  private readonly targetQuaternion = new THREE.Quaternion();

  private readonly easeDuration: number;
  private elapsed = 0;
  private ending = false;
  private endElapsed = 0;
  private finished = false;

  constructor(
    camera: THREE.PerspectiveCamera,
    flagFocus: THREE.Vector3,
    message: SummitMessage,
    onWarmth: (mix: number) => void,
    config: SummitConfig = summitConfig,
  ) {
    this.camera = camera;
    this.message = message;
    this.onWarmth = onWarmth;
    this.config = config;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.easeDuration = reducedMotion ? 1.2 : config.easeDuration;

    this.startQuaternion.copy(camera.quaternion);
    const lookMatrix = new THREE.Matrix4().lookAt(camera.position, flagFocus, camera.up);
    this.targetQuaternion.setFromRotationMatrix(lookMatrix);

    window.addEventListener('keydown', this.handleInterrupt);
    window.addEventListener('pointerdown', this.handleInterrupt);
  }

  /** Advances the moment; returns true when control should return. */
  update(delta: number): boolean {
    if (this.finished) return true;

    this.elapsed += delta;

    const warmth = smootherstep(THREE.MathUtils.clamp(this.elapsed / this.config.warmthRamp, 0, 1));
    this.onWarmth(warmth);

    const gaze = smootherstep(THREE.MathUtils.clamp(this.elapsed / this.easeDuration, 0, 1));
    this.camera.quaternion.slerpQuaternions(this.startQuaternion, this.targetQuaternion, gaze);

    if (this.ending) {
      this.endElapsed += delta;
      if (this.endElapsed >= END_FADE) this.finish();
      return this.finished;
    }

    this.message.applyCues(this.elapsed, this.config.lines);
    if (this.elapsed >= this.config.duration) this.finish();
    return this.finished;
  }

  private readonly handleInterrupt = (): void => {
    if (this.ending || this.finished || this.elapsed < this.config.interruptGrace) return;
    this.ending = true;
    this.message.clear();
  };

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    // Warmth stays at full — the flame remains brighter for the visit.
    this.onWarmth(1);
    this.message.clear();
    this.removeListeners();
  }

  private removeListeners(): void {
    window.removeEventListener('keydown', this.handleInterrupt);
    window.removeEventListener('pointerdown', this.handleInterrupt);
  }

  dispose(): void {
    this.removeListeners();
  }
}
