import * as THREE from 'three';
import { journeyConfig, type JourneyConfig } from '@/config/journey';
import type { MemorialEntry } from '@/data/memorialData';
import type { StoneCard } from '@/world/memorial/StoneCard';
import type { InfoPanel } from '@/ui/InfoPanel';

export interface JourneyAnchor {
  readonly x: number;
  readonly z: number;
  /** World height where the floating card hovers (above the stone). */
  readonly cardY: number;
  readonly entry: MemorialEntry;
}

/**
 * Watches where the visitor stands AND where they look. A stone's card
 * rises above it when the visitor is close and their gaze rests on it
 * (or when they stand right beside it), and fades when the gaze moves
 * on. Hysteresis on both distance and angle keeps the card steady.
 * The hidden live-region panel mirrors the card for screen readers.
 */
export class JourneyGuide {
  private readonly anchors: readonly JourneyAnchor[];
  private readonly panel: InfoPanel;
  private readonly card: StoneCard;
  private readonly config: JourneyConfig;

  private readonly forward = new THREE.Vector3();
  private readonly toAnchor = new THREE.Vector3();
  private readonly cardPosition = new THREE.Vector3();

  private readonly focusCos: number;
  private readonly releaseCos: number;
  private active: JourneyAnchor | null = null;

  constructor(
    anchors: readonly JourneyAnchor[],
    panel: InfoPanel,
    card: StoneCard,
    config: JourneyConfig = journeyConfig,
  ) {
    this.anchors = anchors;
    this.panel = panel;
    this.card = card;
    this.config = config;
    this.focusCos = Math.cos(THREE.MathUtils.degToRad(config.focusDegrees));
    this.releaseCos = Math.cos(THREE.MathUtils.degToRad(config.releaseDegrees));
  }

  update(camera: THREE.PerspectiveCamera): void {
    camera.getWorldDirection(this.forward);

    // Hold the active stone while it stays close enough and looked-at
    // enough — release thresholds are looser than acquisition ones.
    if (this.active) {
      const { distance, gazeCos } = this.measure(this.active, camera);
      const held =
        distance <= this.config.releaseDistance &&
        (gazeCos >= this.releaseCos || distance <= this.config.nearRadius);
      if (held) return;
    }

    let best: JourneyAnchor | null = null;
    let bestGaze = -Infinity;
    for (const anchor of this.anchors) {
      const { distance, gazeCos } = this.measure(anchor, camera);
      if (distance > this.config.maxDistance) continue;
      const qualifies = gazeCos >= this.focusCos || distance <= this.config.nearRadius;
      if (qualifies && gazeCos > bestGaze) {
        best = anchor;
        bestGaze = gazeCos;
      }
    }

    if (best === this.active) return;
    this.active = best;

    if (best) {
      this.cardPosition.set(best.x, best.cardY, best.z);
      this.card.show(best.entry, this.cardPosition);
      this.panel.present(best.entry);
    } else {
      this.card.hide();
      this.panel.clear();
    }
  }

  /** Distance and gaze alignment from the camera to a stone's card point. */
  private measure(
    anchor: JourneyAnchor,
    camera: THREE.PerspectiveCamera,
  ): { distance: number; gazeCos: number } {
    this.toAnchor.set(anchor.x, anchor.cardY, anchor.z).sub(camera.position);
    const distance = Math.hypot(this.toAnchor.x, this.toAnchor.z);
    this.toAnchor.normalize();
    return { distance, gazeCos: this.toAnchor.dot(this.forward) };
  }

  /** Clears any visible card immediately (used when a cinematic begins). */
  clear(): void {
    this.active = null;
    this.card.hide();
    this.panel.clear();
  }
}
