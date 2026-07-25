import * as THREE from 'three';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

/**
 * Installs BVH-accelerated raycasting globally. Importing this module once
 * is enough; geometries opt in via computeBoundsTree().
 */
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

/** Builds (or rebuilds) bounds trees for every mesh under `root`. */
export function buildBoundsTrees(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && !object.geometry.boundsTree) {
      object.geometry.computeBoundsTree();
    }
  });
}

/** Frees the bounds trees under `root` (geometry itself is untouched). */
export function disposeBoundsTrees(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.geometry.boundsTree) {
      object.geometry.disposeBoundsTree();
    }
  });
}
