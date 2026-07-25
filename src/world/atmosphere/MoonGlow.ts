import * as THREE from 'three';

/**
 * A soft additive halo behind the moon. The gradient texture is generated
 * on a canvas at runtime — no asset required.
 */
export class MoonGlow {
  readonly sprite: THREE.Sprite;

  private readonly texture: THREE.CanvasTexture;
  private readonly material: THREE.SpriteMaterial;

  constructor(position: THREE.Vector3, scale: number, color: number, opacity: number) {
    this.texture = MoonGlow.createGradientTexture();

    this.material = new THREE.SpriteMaterial({
      map: this.texture,
      color,
      opacity,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });

    this.sprite = new THREE.Sprite(this.material);
    this.sprite.name = 'moon-glow';
    this.sprite.position.copy(position);
    this.sprite.scale.setScalar(scale);
    this.sprite.renderOrder = 1;
  }

  private static createGradientTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2,
    );
    gradient.addColorStop(0.0, 'rgba(255,255,255,0.85)');
    gradient.addColorStop(0.25, 'rgba(255,255,255,0.28)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.07)');
    gradient.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
    this.sprite.removeFromParent();
  }
}
