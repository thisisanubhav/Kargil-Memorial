import * as THREE from 'three';
import type { SnowConfig } from '@/config/atmosphere';
import type { WindUniforms } from './wind';

/**
 * GPU snow: particle positions are uploaded once and never touched again.
 * Falling, wind advection and drift all happen in the vertex shader by
 * wrapping each particle inside a world-space box with mod(), driven by
 * the shared wind clock.
 */
export class Snowfall {
  readonly points: THREE.Points;

  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;

  constructor(config: SnowConfig, wind: WindUniforms, intensity: number) {
    // Scale density with viewport area so small screens push fewer
    // particles and fewer overdrawn fragments.
    const viewportScale = THREE.MathUtils.clamp(
      (window.innerWidth * window.innerHeight) / (1600 * 900),
      0.45,
      1,
    );
    const count = Math.round(config.count * intensity * viewportScale);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);

    const [cx, cy, cz] = config.center;
    const [w, h, d] = config.area;
    for (let i = 0; i < count; i += 1) {
      positions[i * 3 + 0] = cx + (Math.random() - 0.5) * w;
      positions[i * 3 + 1] = cy + (Math.random() - 0.5) * h;
      positions[i * 3 + 2] = cz + (Math.random() - 0.5) * d;
      seeds[i] = Math.random();
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uWindTime: wind.uWindTime,
        uWindDir: wind.uWindDir,
        uCenter: { value: new THREE.Vector3(cx, cy, cz) },
        uArea: { value: new THREE.Vector3(w, h, d) },
        uFallSpeed: { value: config.fallSpeed },
        uDrift: { value: config.drift },
        uSize: { value: config.size },
        uOpacity: { value: config.opacity },
        uColor: { value: new THREE.Color(config.color) },
      },
      vertexShader: /* glsl */ `
        uniform float uWindTime;
        uniform vec2 uWindDir;
        uniform vec3 uCenter;
        uniform vec3 uArea;
        uniform float uFallSpeed;
        uniform float uDrift;
        uniform float uSize;
        attribute float aSeed;
        varying float vFade;

        void main() {
          vec3 half_ = uArea * 0.5;
          float speed = uFallSpeed * (0.6 + 0.8 * aSeed);
          float sway = sin(uWindTime * (0.4 + aSeed * 0.8) + aSeed * 6.2831) * uDrift;

          vec3 p;
          p.y = uCenter.y - half_.y +
            mod(position.y - uCenter.y + half_.y - uWindTime * speed, uArea.y);
          p.x = uCenter.x - half_.x +
            mod(position.x - uCenter.x + half_.x
              + uWindTime * uWindDir.x * (0.5 + aSeed) + sway, uArea.x);
          p.z = uCenter.z - half_.z +
            mod(position.z - uCenter.z + half_.z
              + uWindTime * uWindDir.y * (0.5 + aSeed) + sway * 0.6, uArea.z);

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = min(uSize * (280.0 / max(1.0, -mv.z)) * (0.5 + 0.5 * aSeed), 18.0);
          // Fade flakes near the top/bottom of the volume so wrapping is invisible.
          vFade = smoothstep(half_.y, half_.y * 0.78, abs(p.y - uCenter.y));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vFade;

        void main() {
          float dist = length(gl_PointCoord - 0.5);
          float alpha = smoothstep(0.5, 0.12, dist) * uOpacity * vFade;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = 'snowfall';
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.points.removeFromParent();
  }
}
