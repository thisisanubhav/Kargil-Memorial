import * as THREE from 'three';
import type { MemorialEntry } from '@/data/memorialData';
import type { CircleObstacle } from '@/controls/VisitorControls';
import { createStoneFaceTexture, createStoneTexture } from './textures';

export interface StoneVisualConfig {
  readonly slab: { readonly width: number; readonly height: number; readonly depth: number };
  readonly base: { readonly width: number; readonly height: number; readonly depth: number };
  /** Backward lean of each slab, radians. */
  readonly tilt: number;
  readonly obstacleRadius: number;
}

export interface StonePlacement {
  readonly x: number;
  readonly z: number;
  /** Height of the ground/floor the base sits on. */
  readonly floorY: number;
  /** World bearing the engraved face looks toward. */
  readonly facing: number;
}

/**
 * A set of memorial stones — one per honoured soldier, generated entirely
 * from data and caller-supplied placements (a summit arc, a trail, any
 * layout). Slabs and bases are two InstancedMeshes sharing one stone
 * material; only each engraved face is unique, carrying a canvas texture
 * composed from the entry's fields.
 */
export class MemorialStones {
  readonly group = new THREE.Group();
  readonly obstacles: CircleObstacle[] = [];

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];

  constructor(
    entries: readonly MemorialEntry[],
    placements: readonly StonePlacement[],
    config: StoneVisualConfig,
  ) {
    this.group.name = 'memorial-stones';
    const count = Math.min(entries.length, placements.length);

    const stoneTexture = createStoneTexture();
    stoneTexture.repeat.set(2, 2);
    this.textures.push(stoneTexture);
    const stoneMaterial = new THREE.MeshStandardMaterial({
      map: stoneTexture,
      roughness: 0.95,
      metalness: 0.02,
    });
    this.materials.push(stoneMaterial);

    const slabGeometry = new THREE.BoxGeometry(
      config.slab.width,
      config.slab.height,
      config.slab.depth,
    );
    const baseGeometry = new THREE.BoxGeometry(
      config.base.width,
      config.base.height,
      config.base.depth,
    );
    this.geometries.push(slabGeometry, baseGeometry);

    const slabs = new THREE.InstancedMesh(slabGeometry, stoneMaterial, count);
    const bases = new THREE.InstancedMesh(baseGeometry, stoneMaterial, count);
    slabs.castShadow = true;
    slabs.receiveShadow = true;
    bases.castShadow = true;
    bases.receiveShadow = true;

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3(1, 1, 1);
    const euler = new THREE.Euler();

    for (let index = 0; index < count; index += 1) {
      const entry = entries[index]!;
      const { x, z, floorY, facing } = placements[index]!;
      // Deterministic, subtle per-stone variation.
      const lean = config.tilt + ((index % 3) - 1) * 0.012;
      const slabY = floorY + config.base.height + config.slab.height / 2 - 0.03;

      euler.set(lean, facing, 0, 'YXZ');
      quaternion.setFromEuler(euler);
      position.set(x, slabY, z);
      matrix.compose(position, quaternion, scale);
      slabs.setMatrixAt(index, matrix);

      euler.set(0, facing, 0, 'YXZ');
      const uprightQuaternion = new THREE.Quaternion().setFromEuler(euler);
      position.set(x, floorY + config.base.height / 2, z);
      matrix.compose(position, uprightQuaternion, scale);
      bases.setMatrixAt(index, matrix);

      // Engraved face: a unique canvas texture per entry, floated just
      // off the slab front along the slab's local +Z.
      const texture = createStoneFaceTexture(entry);
      this.textures.push(texture);
      const faceMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.62,
        metalness: 0.12,
      });
      this.materials.push(faceMaterial);

      const faceGeometry = new THREE.PlaneGeometry(
        config.slab.width - 0.12,
        config.slab.height - 0.14,
      );
      faceGeometry.translate(0, 0, config.slab.depth / 2 + 0.005);
      this.geometries.push(faceGeometry);

      const face = new THREE.Mesh(faceGeometry, faceMaterial);
      face.position.set(x, slabY, z);
      face.quaternion.copy(quaternion);
      face.receiveShadow = true;
      this.group.add(face);

      this.obstacles.push({ x, z, radius: config.obstacleRadius });
    }

    slabs.instanceMatrix.needsUpdate = true;
    bases.instanceMatrix.needsUpdate = true;
    this.group.add(slabs, bases);
  }

  dispose(): void {
    this.geometries.forEach((geometry) => geometry.dispose());
    this.geometries.length = 0;
    this.materials.forEach((material) => material.dispose());
    this.materials.length = 0;
    this.textures.forEach((texture) => texture.dispose());
    this.textures.length = 0;
    this.obstacles.length = 0;
    this.group.removeFromParent();
    this.group.clear();
  }
}
