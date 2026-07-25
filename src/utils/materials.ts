import * as THREE from 'three';

/**
 * Replaces every material under `root` with an unlit MeshBasicMaterial
 * that keeps the original color map. Used for self-luminous objects (the
 * moon) that must not react to scene lighting.
 *
 * Returns the materials it created so the caller can dispose them; the
 * replaced originals are disposed here because nothing references them
 * afterwards.
 */
export function convertToUnlit(root: THREE.Object3D, options?: { fog?: boolean }): THREE.Material[] {
  const created: THREE.Material[] = [];

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    const originals = Array.isArray(object.material) ? object.material : [object.material];
    const replacements = originals.map((original) => {
      const basic = new THREE.MeshBasicMaterial();
      basic.fog = options?.fog ?? true;
      if ('map' in original && original.map instanceof THREE.Texture) {
        basic.map = original.map;
      }
      if ('color' in original && original.color instanceof THREE.Color) {
        basic.color.copy(original.color);
      }
      original.dispose();
      created.push(basic);
      return basic;
    });

    object.material = Array.isArray(object.material) ? replacements : replacements[0]!;
  });

  return created;
}

/** Sets anisotropic filtering on every color map under `root`. */
export function applyAnisotropy(root: THREE.Object3D, anisotropy: number): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if ('map' in material && material.map instanceof THREE.Texture) {
        material.map.anisotropy = anisotropy;
      }
    }
  });
}

/** Enables or disables shadow casting/receiving on every mesh under `root`. */
export function setShadowFlags(root: THREE.Object3D, cast: boolean, receive: boolean): void {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = cast;
      object.receiveShadow = receive;
    }
  });
}
