import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { AtmosphereConfig } from '@/config/atmosphere';
import type { ViewportSize } from './ResizeManager';

/**
 * The cinematic pipeline: scene → bloom → grade (vignette + cool shadow
 * lift, in linear space) → OutputPass (ACES tone mapping + sRGB). Renders
 * into an MSAA half-float target so bloom works on HDR values and edges
 * stay clean.
 */
export class PostProcessing {
  private readonly composer: EffectComposer;
  private readonly renderTarget: THREE.WebGLRenderTarget;
  private readonly bloomPass: UnrealBloomPass;
  private readonly gradePass: ShaderPass;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    config: Pick<AtmosphereConfig, 'bloom' | 'grade'>,
    size: ViewportSize,
  ) {
    const width = Math.floor(size.width * size.pixelRatio);
    const height = Math.floor(size.height * size.pixelRatio);

    this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      samples: 4,
    });

    this.composer = new EffectComposer(renderer, this.renderTarget);
    this.composer.setPixelRatio(size.pixelRatio);
    this.composer.setSize(size.width, size.height);

    this.composer.addPass(new RenderPass(scene, camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      config.bloom.strength,
      config.bloom.radius,
      config.bloom.threshold,
    );
    this.composer.addPass(this.bloomPass);

    this.gradePass = new ShaderPass({
      name: 'GradeShader',
      uniforms: {
        tDiffuse: { value: null },
        uVignetteStrength: { value: config.grade.vignetteStrength },
        uVignetteStart: { value: config.grade.vignetteStart },
        uVignetteEnd: { value: config.grade.vignetteEnd },
        uShadowLift: { value: new THREE.Vector3(...config.grade.shadowLift) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float uVignetteStrength;
        uniform float uVignetteStart;
        uniform float uVignetteEnd;
        uniform vec3 uShadowLift;
        varying vec2 vUv;

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);

          float dist = distance(vUv, vec2(0.5));
          float vignette = smoothstep(uVignetteStart, uVignetteEnd, dist);
          color.rgb *= 1.0 - vignette * uVignetteStrength;

          float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
          color.rgb += uShadowLift * (1.0 - smoothstep(0.0, 0.3, luma));

          gl_FragColor = color;
        }
      `,
    });
    this.composer.addPass(this.gradePass);

    this.composer.addPass(new OutputPass());
  }

  setSize({ width, height, pixelRatio }: ViewportSize): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
  }

  render(delta: number): void {
    this.composer.render(delta);
  }

  dispose(): void {
    this.composer.dispose();
    this.renderTarget.dispose();
  }
}
