import * as THREE from 'three';
import type { RendererConfig } from '@/config/types';
import type { ViewportSize } from './ResizeManager';

/**
 * Owns the WebGLRenderer and its canvas. All output settings (color space,
 * tone mapping, shadows, pixel ratio) are decided here and nowhere else.
 */
export class RendererManager {
  readonly renderer: THREE.WebGLRenderer;

  constructor(container: HTMLElement, config: RendererConfig, initialSize: ViewportSize) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: config.antialias,
      powerPreference: 'high-performance',
      stencil: false,
    });

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = config.toneMappingExposure;
    this.renderer.shadowMap.enabled = config.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.setSize(initialSize);
    container.appendChild(this.renderer.domElement);
  }

  setSize({ width, height, pixelRatio }: ViewportSize): void {
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height);
  }

  dispose(): void {
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
