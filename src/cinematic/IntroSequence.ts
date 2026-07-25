import * as THREE from 'three';
import { introConfig, type IntroConfig } from '@/config/intro';
import type { IntroOverlay } from '@/ui/IntroOverlay';

const SKIP_DIP = 0.4;
const SKIP_CLEAR = 1.0;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * The cinematic introduction: a slow fly-through on a Catmull-Rom spline
 * — high above the mountains, lifting the gaze to the moon, descending
 * over the snowbound valley — that lands exactly on the visitor's start
 * pose, so the handover to walking is seamless by construction.
 *
 * Any key or click skips (a quick dip to black, cut, dissolve back).
 * Under prefers-reduced-motion there is no fly-through at all: the
 * camera holds the start pose while the titles pass.
 */
export class IntroSequence {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly overlay: IntroOverlay;
  private readonly config: IntroConfig;

  private readonly positionCurve: THREE.CatmullRomCurve3;
  private readonly targetCurve: THREE.CatmullRomCurve3;
  private readonly endPosition: THREE.Vector3;
  private readonly endTarget: THREE.Vector3;

  private readonly duration: number;
  private readonly cueScale: number;
  private readonly reducedMotion: boolean;

  private elapsed = 0;
  private skipping = false;
  private skipElapsed = 0;
  private skipCut = false;
  private finished = false;

  constructor(
    camera: THREE.PerspectiveCamera,
    endPosition: THREE.Vector3,
    endTarget: THREE.Vector3,
    overlay: IntroOverlay,
    config: IntroConfig = introConfig,
  ) {
    this.camera = camera;
    this.overlay = overlay;
    this.config = config;
    this.endPosition = endPosition.clone();
    this.endTarget = endTarget.clone();

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.duration = this.reducedMotion ? config.reducedDuration : config.duration;
    this.cueScale = this.duration / config.duration;

    const positions = [...config.positions.map((p) => new THREE.Vector3(...p)), this.endPosition];
    const targets = [...config.targets.map((p) => new THREE.Vector3(...p)), this.endTarget];
    this.positionCurve = new THREE.CatmullRomCurve3(positions, false, 'centripetal');
    this.targetCurve = new THREE.CatmullRomCurve3(targets, false, 'centripetal');

    window.addEventListener('keydown', this.requestSkip);
    window.addEventListener('pointerdown', this.requestSkip);
  }

  /** Advances the sequence; returns true once control should pass to the visitor. */
  update(delta: number): boolean {
    if (this.finished) return true;

    if (this.skipping) {
      this.skipElapsed += delta;
      if (!this.skipCut && this.skipElapsed >= SKIP_DIP) {
        this.skipCut = true;
        this.placeCamera(1);
        this.overlay.clearVeilFast();
      }
      if (this.skipElapsed >= SKIP_DIP + SKIP_CLEAR) {
        this.complete();
      }
      return this.finished;
    }

    this.elapsed += delta;
    const t = THREE.MathUtils.clamp(this.elapsed / this.duration, 0, 1);
    this.placeCamera(easeInOutCubic(t));

    const cueTime = this.elapsed / this.cueScale;
    this.overlay.applyCues(
      cueTime,
      this.config.lines,
      this.config.veilFadeEnd,
      this.config.skipHintAt,
    );

    if (t >= 1) this.complete();
    return this.finished;
  }

  private placeCamera(eased: number): void {
    if (this.reducedMotion) {
      this.camera.position.copy(this.endPosition);
      this.camera.lookAt(this.endTarget);
      return;
    }
    this.camera.position.copy(this.positionCurve.getPointAt(eased));
    this.camera.lookAt(this.targetCurve.getPointAt(eased));
  }

  private readonly requestSkip = (): void => {
    if (this.skipping || this.finished) return;
    this.skipping = true;
    this.skipElapsed = 0;
    this.overlay.blackout();
  };

  private complete(): void {
    if (this.finished) return;
    this.finished = true;
    this.placeCamera(1);
    this.overlay.finish();
    this.removeListeners();
  }

  private removeListeners(): void {
    window.removeEventListener('keydown', this.requestSkip);
    window.removeEventListener('pointerdown', this.requestSkip);
  }

  dispose(): void {
    this.removeListeners();
    this.overlay.dispose();
  }
}
