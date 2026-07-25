import * as THREE from 'three';

function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) {
      value.dispose();
    }
  }
  material.dispose();
}

/**
 * Recursively releases every GPU resource (geometries, materials, textures)
 * owned by an object hierarchy. Safe to call on any Object3D.
 */
export function deepDispose(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
      object.geometry?.dispose();
      const material = object.material as THREE.Material | THREE.Material[];
      if (Array.isArray(material)) {
        material.forEach(disposeMaterial);
      } else if (material) {
        disposeMaterial(material);
      }
    }
  });
}
