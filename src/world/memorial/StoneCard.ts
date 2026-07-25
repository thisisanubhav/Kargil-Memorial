import * as THREE from 'three';
import type { MemorialEntry } from '@/data/memorialData';
import { drawWrapped } from './textures';

const CARD_WIDTH = 1.72;
const CARD_HEIGHT = 1.06;
const CANVAS_WIDTH = 860;
const CANVAS_HEIGHT = 530;

function damp(current: number, target: number, tau: number, delta: number): number {
  return target + (current - target) * Math.exp(-delta / tau);
}

/**
 * The floating information card that appears above a memorial stone when
 * the visitor stands near and looks at it, and fades away when their
 * gaze moves on. One mesh and one canvas texture serve every stone —
 * content is redrawn on the fly when the focused stone changes.
 */
export class StoneCard {
  readonly mesh: THREE.Mesh;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: THREE.CanvasTexture;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly geometry: THREE.PlaneGeometry;

  private current: MemorialEntry | null = null;
  private pending: { entry: MemorialEntry; position: THREE.Vector3 } | null = null;
  private targetVisible = false;
  private opacity = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;

    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      // UI in the world: never fogged, never tone-mapped into the grade.
      fog: false,
      toneMapped: false,
    });

    this.geometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'stone-card';
    this.mesh.renderOrder = 20;
    this.mesh.visible = false;
  }

  /** Presents an entry above a stone; swaps with a quick fade if changed. */
  show(entry: MemorialEntry, position: THREE.Vector3): void {
    if (this.current === entry) {
      this.targetVisible = true;
      return;
    }
    if (this.opacity > 0.05) {
      // Fade the old card out first; update() applies the swap.
      this.pending = { entry, position: position.clone() };
      this.targetVisible = false;
      return;
    }
    this.apply(entry, position);
  }

  hide(): void {
    this.targetVisible = false;
    this.pending = null;
  }

  update(delta: number, camera: THREE.Camera): void {
    if (!this.targetVisible && this.pending && this.opacity <= 0.03) {
      const { entry, position } = this.pending;
      this.pending = null;
      this.apply(entry, position);
    }

    this.opacity = damp(this.opacity, this.targetVisible ? 1 : 0, 0.11, delta);
    if (this.opacity < 0.01 && !this.targetVisible) {
      this.mesh.visible = false;
      if (!this.pending) this.current = null;
      return;
    }

    this.mesh.visible = true;
    this.material.opacity = this.opacity;
    const scale = 0.94 + 0.06 * this.opacity;
    this.mesh.scale.setScalar(scale);

    // Cylindrical billboard: face the visitor, stay upright.
    this.mesh.rotation.y = Math.atan2(
      camera.position.x - this.mesh.position.x,
      camera.position.z - this.mesh.position.z,
    );
  }

  private apply(entry: MemorialEntry, position: THREE.Vector3): void {
    this.current = entry;
    this.mesh.position.copy(position);
    this.draw(entry);
    this.targetVisible = true;
  }

  private draw(entry: MemorialEntry): void {
    const ctx = this.ctx;
    const w = CANVAS_WIDTH;
    const h = CANVAS_HEIGHT;
    const centerX = w / 2;
    const maxWidth = w - 110;

    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.roundRect(6, 6, w - 12, h - 12, 22);
    ctx.fillStyle = 'rgba(9, 12, 20, 0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(217, 196, 137, 0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = '#e5d6a3';
    ctx.font = '700 54px Georgia, serif';
    let y = drawWrapped(ctx, entry.name, centerX, 88, maxWidth, 60);

    ctx.fillStyle = '#c9a45c';
    ctx.font = '600 26px Georgia, serif';
    y = drawWrapped(ctx, `${entry.rank.toUpperCase()} · ${entry.award.toUpperCase()}`, centerX, y + 14, maxWidth, 34);

    ctx.fillStyle = 'rgba(232, 228, 218, 0.95)';
    ctx.font = 'italic 30px Georgia, serif';
    y = drawWrapped(ctx, `“${entry.quote}”`, centerX, y + 34, maxWidth, 40);

    ctx.fillStyle = 'rgba(200, 196, 182, 0.82)';
    ctx.font = '25px Georgia, serif';
    drawWrapped(ctx, entry.summary, centerX, y + 30, maxWidth, 34);

    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.mesh.removeFromParent();
  }
}
