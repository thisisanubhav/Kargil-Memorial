import * as THREE from 'three';

/**
 * The single wind clock. Every wind-driven shader (snow, ground fog, tree
 * sway, flag cloth) references these uniform objects BY REFERENCE, so one
 * update per frame moves the whole scene coherently.
 */
export interface WindUniforms {
  readonly uWindTime: THREE.IUniform<number>;
  readonly uWindDir: THREE.IUniform<THREE.Vector2>;
}

export function createWindUniforms(direction: readonly [number, number]): WindUniforms {
  return {
    uWindTime: { value: 0 },
    uWindDir: { value: new THREE.Vector2(direction[0], direction[1]) },
  };
}
