import * as THREE from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import type { WindUniforms } from '@/world/atmosphere/wind';

/**
 * Realistic flag waving without naming a single mesh. Meshes are
 * classified by their geometry: the pole is much taller than it is wide,
 * the cloth is wider than it is tall. The cloth material then gets a
 * traveling-wave vertex displacement whose amplitude ramps from zero at
 * the pole edge to full at the free edge — pinned like real bunting —
 * with an analytic normal tilt so moonlight and floodlight move across
 * the fabric as it waves.
 */
export class FlagAnimator {
  constructor(flagRoot: THREE.Object3D, wind: WindUniforms, waveStrength: number) {
    const meshes: THREE.Mesh[] = [];
    flagRoot.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object);
    });

    const size = new THREE.Vector3();
    let poleCenterX: number | null = null;
    const clothCandidates: Array<{ mesh: THREE.Mesh; box: THREE.Box3 }> = [];

    for (const mesh of meshes) {
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox!;
      box.getSize(size);
      if (size.y > size.x * 2) {
        poleCenterX = (box.min.x + box.max.x) / 2;
      } else {
        clothCandidates.push({ mesh, box });
      }
    }

    for (const { mesh, box } of clothCandidates) {
      const anchorX = poleCenterX ?? (Math.abs(box.min.x) < Math.abs(box.max.x) ? box.min.x : box.max.x);
      const attachedIsMin =
        Math.abs(box.min.x - anchorX) <= Math.abs(box.max.x - anchorX);
      const edge = attachedIsMin ? box.min.x : box.max.x;
      const span = attachedIsMin ? box.max.x - box.min.x : box.min.x - box.max.x;
      if (Math.abs(span) < 1e-5) continue;

      this.patchClothMaterial(mesh, edge, span, wind, waveStrength);
    }
  }

  private patchClothMaterial(
    mesh: THREE.Mesh,
    edge: number,
    span: number,
    wind: WindUniforms,
    waveStrength: number,
  ): void {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    for (const material of materials) {
      material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
        shader.uniforms.uWindTime = wind.uWindTime;
        shader.uniforms.uWaveStrength = { value: waveStrength };
        shader.uniforms.uClothEdge = { value: edge };
        shader.uniforms.uClothSpan = { value: span };

        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            /* glsl */ `#include <common>
            uniform float uWindTime;
            uniform float uWaveStrength;
            uniform float uClothEdge;
            uniform float uClothSpan;

            float clothWave(vec3 p, out float slopeX) {
              float t = clamp((p.x - uClothEdge) / uClothSpan, 0.0, 1.0);
              float p1 = t * 7.0 - uWindTime * 3.1;
              float p2 = t * 12.0 - uWindTime * 5.2 + p.y * 4.0;
              float wave = sin(p1) * 0.7 + sin(p2) * 0.3;
              float dWave = cos(p1) * 7.0 * 0.7 + cos(p2) * 12.0 * 0.3;
              float amp = t * uWaveStrength;
              slopeX = (dWave * t + wave) * uWaveStrength / abs(uClothSpan);
              return wave * amp;
            }`,
          )
          .replace(
            '#include <beginnormal_vertex>',
            /* glsl */ `#include <beginnormal_vertex>
            {
              float cloth_slope;
              clothWave(position, cloth_slope);
              objectNormal = normalize(objectNormal - vec3(cloth_slope * sign(objectNormal.z), 0.0, 0.0));
            }`,
          )
          .replace(
            '#include <begin_vertex>',
            /* glsl */ `#include <begin_vertex>
            {
              float cloth_unused;
              float cloth_t = clamp((position.x - uClothEdge) / uClothSpan, 0.0, 1.0);
              transformed.z += clothWave(position, cloth_unused);
              transformed.y += sin(cloth_t * 5.0 - uWindTime * 2.2) * cloth_t * uWaveStrength * 0.2;
            }`,
          );
      };
      material.customProgramCacheKey = () => 'kargil-flag-wave';
      material.needsUpdate = true;
    }
  }
}
