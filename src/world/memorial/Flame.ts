import * as THREE from 'three';

export interface FlameLightConfig {
  readonly color: number;
  readonly intensity: number;
  readonly distance: number;
  readonly flicker: number;
}

/**
 * The eternal flame: three crossed shader planes with rising FBM noise,
 * output brighter than 1.0 so the bloom pass gives it a soft halo, and a
 * warm point light whose gentle flicker is a sum of incommensurate sines
 * — organic, never strobing.
 */
export class Flame {
  readonly group = new THREE.Group();

  private readonly geometry: THREE.PlaneGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly light: THREE.PointLight;
  private readonly lightConfig: FlameLightConfig;
  private readonly baseDistance: number;
  private time = Math.random() * 100;
  private warmth = 0;
  private warmthBoost = 1;

  constructor(lightConfig: FlameLightConfig) {
    this.group.name = 'eternal-flame';
    this.lightConfig = lightConfig;

    this.geometry = new THREE.PlaneGeometry(0.85, 1.4);
    this.geometry.translate(0, 0.7, 0);

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
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
            p *= 2.11;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          float x = vUv.x * 2.0 - 1.0;
          float n = fbm(vec2(x * 2.2, vUv.y * 3.0 - uTime * 2.1));

          float width = mix(0.62, 0.05, vUv.y);
          float d = abs(x) - width * (0.7 + 0.5 * n);
          float body = smoothstep(0.1, -0.28, d);
          body *= smoothstep(0.0, 0.14, vUv.y);
          body *= smoothstep(1.02, 0.5, vUv.y + n * 0.3);

          if (body < 0.02) discard;

          vec3 color = mix(vec3(0.85, 0.22, 0.04), vec3(1.0, 0.8, 0.3), pow(body, 1.5));
          color = mix(color, vec3(1.0, 0.96, 0.78), pow(max(body - 0.4, 0.0) * 1.6, 2.0));

          gl_FragColor = vec4(color * 1.7, body * 0.9);
        }
      `,
    });

    for (let i = 0; i < 3; i += 1) {
      const plane = new THREE.Mesh(this.geometry, this.material);
      plane.rotation.y = (i / 3) * Math.PI;
      this.group.add(plane);
    }

    this.light = new THREE.PointLight(
      lightConfig.color,
      lightConfig.intensity,
      lightConfig.distance,
      2,
    );
    this.light.position.set(0, 1.0, 0);
    this.baseDistance = lightConfig.distance;
    this.group.add(this.light);
  }

  /**
   * Blooms the flame: brighter, further-reaching light and a slightly
   * taller fire. `mix` is 0–1; targets come from the summit config.
   */
  setWarmth(mix: number, boost: number, reach: number, scale: number): void {
    this.warmth = mix;
    this.warmthBoost = boost;

    this.light.distance = this.baseDistance + reach * mix;
    const s = 1 + (scale - 1) * mix;
    this.group.scale.setScalar(s);
    this.group.updateMatrix();
    this.group.updateMatrixWorld(true);
  }

  update(delta: number): void {
    this.time += delta;
    this.material.uniforms.uTime!.value = this.time;

    const flicker =
      (Math.sin(this.time * 7.3) + Math.sin(this.time * 11.9 + 1.7) + Math.sin(this.time * 3.1 + 0.4)) / 3;
    const base =
      this.lightConfig.intensity * (1 + (this.warmthBoost - 1) * this.warmth);
    this.light.intensity = base * (1 + flicker * this.lightConfig.flicker);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.light.dispose();
    this.group.removeFromParent();
    this.group.clear();
  }
}
