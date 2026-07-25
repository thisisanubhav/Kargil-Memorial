import * as THREE from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import type { WindUniforms } from '@/world/atmosphere/wind';

const patchedMaterials = new WeakSet<THREE.Material>();

/**
 * Patches every material under `root` with a gentle vertex-shader sway:
 * amplitude grows with height squared (trunks barely move, crowns breathe)
 * and phase comes from world position, so cloned clusters never move in
 * lockstep. Cloned meshes share materials, so each material is patched
 * exactly once and the whole forest costs one uniform per frame.
 */
export function applyWindSway(root: THREE.Object3D, wind: WindUniforms, strength: number): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];

    for (const material of materials) {
      if (patchedMaterials.has(material)) continue;
      patchedMaterials.add(material);

      material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
        shader.uniforms.uWindTime = wind.uWindTime;
        shader.uniforms.uSwayStrength = { value: strength };

        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            /* glsl */ `#include <common>
            uniform float uWindTime;
            uniform float uSwayStrength;`,
          )
          .replace(
            '#include <begin_vertex>',
            /* glsl */ `#include <begin_vertex>
            {
              vec4 sway_wp = modelMatrix * vec4(position, 1.0);
              float sway_h = clamp(position.y / 6.0, 0.0, 1.0);
              float sway_amp = sway_h * sway_h * uSwayStrength;
              float sway_ph = sway_wp.x * 0.35 + sway_wp.z * 0.28;
              transformed.x += sin(uWindTime * 0.9 + sway_ph) * sway_amp;
              transformed.z += cos(uWindTime * 0.7 + sway_ph * 1.3) * sway_amp * 0.6;
            }`,
          );
      };
      material.customProgramCacheKey = () => 'kargil-wind-sway';
      material.needsUpdate = true;
    }
  });
}
