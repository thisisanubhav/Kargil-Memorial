import * as THREE from 'three';
import type { GroundFogLayer } from '@/config/atmosphere';
import type { WindUniforms } from './wind';

/**
 * Low-lying valley fog: large horizontal planes with scrolling FBM noise,
 * faded radially so their edges never show. Cheap, and convincing at the
 * memorial's viewing distances.
 */
export class GroundFog {
  readonly group = new THREE.Group();

  private readonly disposables: Array<{ dispose(): void }> = [];

  constructor(color: number, layers: readonly GroundFogLayer[], wind: WindUniforms) {
    this.group.name = 'ground-fog';

    const geometry = new THREE.PlaneGeometry(1, 1);
    this.disposables.push(geometry);

    for (const layer of layers) {
      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uWindTime: wind.uWindTime,
          uWindDir: wind.uWindDir,
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: layer.opacity },
          uNoiseScale: { value: layer.noiseScale },
          uScrollSpeed: { value: layer.scrollSpeed },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uWindTime;
          uniform vec2 uWindDir;
          uniform vec3 uColor;
          uniform float uOpacity;
          uniform float uNoiseScale;
          uniform float uScrollSpeed;
          varying vec2 vUv;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
              u.y
            );
          }
          float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 3; i++) {
              v += a * noise(p);
              p *= 2.03;
              a *= 0.5;
            }
            return v;
          }

          void main() {
            vec2 scroll = uWindDir * uWindTime * uScrollSpeed;
            float n = fbm(vUv * uNoiseScale + scroll);
            float edge = smoothstep(0.5, 0.18, distance(vUv, vec2(0.5)));
            float alpha = uOpacity * edge * smoothstep(0.32, 0.78, n);
            if (alpha < 0.003) discard;
            gl_FragColor = vec4(uColor, alpha);
          }
        `,
      });
      this.disposables.push(material);

      const plane = new THREE.Mesh(geometry, material);
      plane.rotation.x = -Math.PI / 2;
      plane.scale.setScalar(layer.size);
      plane.position.y = layer.height;
      plane.renderOrder = 5;
      this.group.add(plane);
    }
  }

  dispose(): void {
    this.disposables.forEach((resource) => resource.dispose());
    this.disposables.length = 0;
    this.group.removeFromParent();
    this.group.clear();
  }
}
