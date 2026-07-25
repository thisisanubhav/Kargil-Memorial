import * as THREE from 'three';
import type { AssetManager } from '@/core/AssetManager';
import type { CameraManager } from '@/core/CameraManager';
import { worldConfig, type PlacementConfig, type WorldConfig } from '@/config/world';
import { applyAnisotropy, convertToUnlit, setShadowFlags } from '@/utils/materials';
import { buildBoundsTrees, disposeBoundsTrees } from '@/utils/bvh';
import { atmosphereConfig } from '@/config/atmosphere';
import { controlsConfig } from '@/config/controls';
import { journeyConfig } from '@/config/journey';
import { memorialConfig } from '@/config/memorial';
import type { MemorialData, MemorialEntry } from '@/data/memorialData';
import { MemorialStones, type StonePlacement } from './memorial/MemorialStones';
import type { CircleObstacle } from '@/controls/VisitorControls';
import { Atmosphere } from './atmosphere/Atmosphere';
import { applyWindSway } from './animation/WindSway';
import { Memorial } from './memorial/Memorial';
import { MoonlightRig } from './MoonlightRig';

const RAY_ORIGIN_HEIGHT = 600;
const DOWN = new THREE.Vector3(0, -1, 0);

/**
 * Scattered-asset meshes larger than this (m, any axis) are backdrop
 * geometry bundled into the asset — not scatter pieces. They are hidden:
 * they belong to the asset's original studio scene, not this world.
 * (The rocks asset ships one ~105 m ground card among its 2–5 m
 * boulders; floating over our valley it blots out the sky.)
 */
const MAX_SCATTER_EXTENT = 12;

/**
 * Assembles the memorial environment from preloaded assets. Everything is
 * placed declaratively from WorldConfig; vertical placement is resolved
 * by raycasting the scaled terrain, so no asset dimensions are assumed.
 *
 * Single-use assets (terrain, rocks, moon, flag) mount the cached glTF
 * scene directly — the AssetManager remains their owner and disposer.
 * Tree clusters are clones sharing GPU resources with the cache, so this
 * class only disposes what it uniquely creates (unlit moon materials,
 * the lighting rig).
 */
export class World {
  readonly group = new THREE.Group();

  private readonly assets: AssetManager;
  private readonly scene: THREE.Scene;
  private readonly config: WorldConfig;
  private readonly raycaster = new THREE.Raycaster();
  private readonly rayOrigin = new THREE.Vector3();
  private readonly ownedMaterials: THREE.Material[] = [];
  private readonly ownedInstances: THREE.InstancedMesh[] = [];

  private terrain: THREE.Object3D | null = null;
  private rocksRoot: THREE.Object3D | null = null;
  private lighting: MoonlightRig | null = null;
  private atmosphere: Atmosphere | null = null;
  private memorial: Memorial | null = null;
  private trailStones: MemorialStones | null = null;
  private summitStones: MemorialStones | null = null;
  private readonly trailAnchors: Array<{
    x: number;
    z: number;
    cardY: number;
    entry: MemorialEntry;
  }> = [];
  private readonly walkObstacles: CircleObstacle[] = [];
  /** Surfaces the ground query walks on: terrain plus memorial floors. */
  private readonly walkables: THREE.Object3D[] = [];

  constructor(assets: AssetManager, scene: THREE.Scene, config: WorldConfig = worldConfig) {
    this.assets = assets;
    this.scene = scene;
    this.config = config;
    this.group.name = 'world';
  }

  build(maxAnisotropy: number, memorialData: MemorialData): void {
    const anisotropy = Math.min(8, maxAnisotropy);

    this.terrain = this.mount(this.assets.getModel('terrain').scene, this.config.terrain);
    setShadowFlags(this.terrain, true, true);
    applyAnisotropy(this.terrain, anisotropy);
    // Every subsequent placement raycasts this terrain; a BVH turns each
    // query from a full-mesh scan into a log-time lookup.
    buildBoundsTrees(this.terrain);
    this.raycaster.firstHitOnly = true;
    this.walkables.push(this.terrain);

    const rocks = this.mount(this.assets.getModel('rocks').scene, this.config.rocks);
    this.rocksRoot = rocks;
    setShadowFlags(rocks, true, true);
    applyAnisotropy(rocks, anisotropy);
    this.collectObstacles(rocks);

    const moonPosition = new THREE.Vector3(...this.config.moon.position);
    this.atmosphere = new Atmosphere(this.scene, moonPosition);
    this.group.add(this.atmosphere.group);

    for (const placement of this.config.treeClusters) {
      const cluster = this.mount(this.assets.getModel('trees').scene.clone(true), placement);
      setShadowFlags(cluster, true, true);
      applyWindSway(cluster, this.atmosphere.wind, atmosphereConfig.wind.treeSway);
    }

    // The memorial site is cleared ground: scatter that landed inside its
    // footprint is removed (meshes hidden, their obstacles dropped).
    this.clearScatter(rocks, memorialConfig.center, memorialConfig.platform.lowerRadius + 2.5);

    this.memorial = new Memorial();
    this.memorial.build({
      groundHeightAt: (x, z) => this.groundHeightAt(x, z),
      wind: this.atmosphere.wind,
      data: memorialData,
    });
    this.group.add(this.memorial.group);
    // The platform and stairs join the ground query so the visitor can
    // climb them; their obstacles join the collision set.
    for (const walkable of this.memorial.walkables) {
      buildBoundsTrees(walkable);
      this.walkables.push(walkable);
    }
    this.walkObstacles.push(...this.memorial.obstacles);

    const trailEntries = memorialData.entries.filter((entry) => entry.location !== 'summit');
    const summitEntries = memorialData.entries.filter((entry) => entry.location === 'summit');
    this.buildTrailStones(trailEntries);
    this.buildSummitStones(summitEntries);

    // All site/trail clearing is done: collapse the boulder field's
    // remaining meshes into instanced draws.
    this.instanceScatter(rocks);

    const moon = this.mount(this.assets.getModel('moon').scene, this.config.moon);
    setShadowFlags(moon, false, false);
    this.ownedMaterials.push(...convertToUnlit(moon, { fog: false }));

    this.lighting = new MoonlightRig(
      this.config.lighting.moonlight,
      this.config.lighting.hemisphere,
      new THREE.Vector3(...this.config.moon.position),
    );
    this.group.add(this.lighting.group);

    this.freezeTransforms();
  }

  /** Advances the wind clock and the memorial's flame. */
  update(delta: number): void {
    this.atmosphere?.update(delta);
    this.memorial?.update(delta);
  }

  /** Circle colliders for every boulder tall enough to block a walker. */
  get obstacles(): readonly CircleObstacle[] {
    return this.walkObstacles;
  }

  /**
   * Derives one XZ circle per boulder mesh from its world bounding box.
   * Small stones are ignored; boxes are shrunk slightly because they
   * overestimate round rocks.
   */
  private collectObstacles(rocksRoot: THREE.Object3D): void {
    const bounds = new THREE.Box3();
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    for (const mesh of this.collectMeshes(rocksRoot)) {
      bounds.setFromObject(mesh);
      if (bounds.isEmpty()) continue;
      bounds.getSize(size);
      if (size.y < controlsConfig.minObstacleHeight) continue;
      if (Math.max(size.x, size.y, size.z) > MAX_SCATTER_EXTENT) continue;
      bounds.getCenter(center);
      this.walkObstacles.push({
        x: center.x,
        z: center.z,
        radius: (Math.max(size.x, size.z) / 2) * controlsConfig.obstacleShrink,
      });
    }
  }

  /** Places the camera at the configured standpoint, eyes on the flag knoll. */
  frameCamera(cameraManager: CameraManager): void {
    const { standpoint, eyeHeight, lookAt, lookAtHeight } = this.config.view;

    const standGround = this.groundHeightAt(standpoint[0], standpoint[1]) ?? 0;
    cameraManager.camera.position.set(standpoint[0], standGround + eyeHeight, standpoint[1]);

    const targetGround = this.groundHeightAt(lookAt[0], lookAt[1]) ?? 0;
    cameraManager.camera.lookAt(lookAt[0], targetGround + lookAtHeight, lookAt[1]);
  }

  private mount(object: THREE.Object3D, placement: PlacementConfig): THREE.Object3D {
    const { position, rotationY = 0, scale = 1, snap = 'none', groundOffset = 0 } = placement;

    if (typeof scale === 'number') {
      object.scale.setScalar(scale);
    } else {
      object.scale.set(...scale);
    }
    object.rotation.y = rotationY;
    object.position.set(...position);
    this.group.add(object);
    object.updateMatrixWorld(true);

    if (placement.snapChildren) {
      this.snapChildrenToGround(object, groundOffset);
    } else if (snap !== 'none') {
      const ground = this.groundHeightAt(position[0], position[2]);
      if (ground === null) {
        console.warn('[kargil] no terrain under object at', position[0], position[2]);
      } else if (snap === 'origin') {
        object.position.y = ground + groundOffset;
      } else {
        const bounds = new THREE.Box3().setFromObject(object);
        object.position.y += ground - bounds.min.y + groundOffset;
      }
      object.updateMatrixWorld(true);
    }

    return object;
  }

  /**
   * Drops each piece of a pre-scattered asset onto the terrain under its
   * own footprint, so scattered pieces follow the slope. Pieces are the
   * mesh descendants — asset roots often wrap everything in a group, so
   * direct children cannot be trusted to be the individual pieces.
   */
  private snapChildrenToGround(parent: THREE.Object3D, groundOffset: number): void {
    const bounds = new THREE.Box3();
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    const worldShift = new THREE.Vector3();
    const parentRotationInv = new THREE.Matrix3();
    const inverse = new THREE.Matrix4();

    for (const mesh of this.collectMeshes(parent)) {
      bounds.setFromObject(mesh);
      if (bounds.isEmpty()) continue;
      bounds.getSize(size);
      if (Math.max(size.x, size.y, size.z) > MAX_SCATTER_EXTENT) {
        mesh.visible = false;
        continue;
      }
      bounds.getCenter(center);

      const ground = this.groundHeightAt(center.x, center.z);
      if (ground === null) continue;

      // The desired shift is straight down in WORLD space. glTF exports
      // routinely rotate intermediate nodes (Z-up conversions), so the
      // world vector must pass through the parent chain's inverse
      // rotation before it can be added to the mesh's local position.
      worldShift.set(0, ground - bounds.min.y + groundOffset, 0);
      if (mesh.parent) {
        inverse.copy(mesh.parent.matrixWorld).invert();
        parentRotationInv.setFromMatrix4(inverse);
        worldShift.applyMatrix3(parentRotationInv);
      }
      mesh.position.add(worldShift);
      mesh.updateMatrixWorld(true);
    }
    parent.updateMatrixWorld(true);
  }

  /** Anchor points (with entries) for the journey's stone cards. */
  get journeyAnchors(): readonly { x: number; z: number; cardY: number; entry: MemorialEntry }[] {
    return this.trailAnchors;
  }

  /** Height at which a stone's floating card hovers, from its floor. */
  private cardHeight(floorY: number): number {
    const { slab, base } = memorialConfig.stones;
    return floorY + base.height + slab.height + 0.62;
  }

  /** Summit geometry for the arrival moment; null before build. */
  get summitInfo(): Memorial['summit'] | null {
    return this.memorial?.summit ?? null;
  }

  /** Passes the arrival warmth through to the memorial's lights. */
  setSummitWarmth(mix: number): void {
    this.memorial?.setWarmth(mix);
  }

  /**
   * Distributes the honoured stones along the walking trail by arc
   * length, alternating sides, snapped to the terrain and facing the
   * path — the visitor meets each hero on the way up.
   */
  private buildTrailStones(entries: readonly MemorialEntry[]): void {
    const points = journeyConfig.waypoints.map(([x, z]) => new THREE.Vector2(x, z));

    // The trail is cleared ground, like the memorial site: boulders
    // sitting in the walking corridor are removed with their obstacles.
    this.clearScatterAlongTrail(points, 2.4);
    const segmentLengths: number[] = [];
    let totalLength = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const length = points[i]!.distanceTo(points[i + 1]!);
      segmentLengths.push(length);
      totalLength += length;
    }

    const usable = totalLength - journeyConfig.startMargin - journeyConfig.endMargin;
    const placements: StonePlacement[] = [];

    entries.forEach((_, index) => {
      const along =
        journeyConfig.startMargin +
        (entries.length > 1 ? (index * usable) / (entries.length - 1) : usable / 2);

      // Locate the point and direction at this arc length.
      let remaining = along;
      let segment = 0;
      while (segment < segmentLengths.length - 1 && remaining > segmentLengths[segment]!) {
        remaining -= segmentLengths[segment]!;
        segment += 1;
      }
      const a = points[segment]!;
      const b = points[segment + 1]!;
      const t = segmentLengths[segment]! > 0 ? remaining / segmentLengths[segment]! : 0;
      const px = a.x + (b.x - a.x) * t;
      const pz = a.y + (b.y - a.y) * t;
      const dirX = (b.x - a.x) / (segmentLengths[segment]! || 1);
      const dirZ = (b.y - a.y) / (segmentLengths[segment]! || 1);

      // Alternate sides; flip if a boulder crowds the spot.
      let side = index % 2 === 0 ? 1 : -1;
      const spot = (s: number): [number, number] => [
        px + -dirZ * journeyConfig.sideOffset * s,
        pz + dirX * journeyConfig.sideOffset * s,
      ];
      let [sx, sz] = spot(side);
      const crowded = (x: number, z: number): boolean =>
        this.walkObstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.radius + 0.9);
      if (crowded(sx, sz)) {
        side = -side;
        [sx, sz] = spot(side);
      }

      const ground = this.groundHeightAt(sx, sz) ?? 0;
      placements.push({
        x: sx,
        z: sz,
        floorY: ground - 0.02,
        facing: Math.atan2(px - sx, pz - sz),
      });
    });

    this.trailStones = new MemorialStones(entries, placements, memorialConfig.stones);
    this.group.add(this.trailStones.group);
    this.walkObstacles.push(...this.trailStones.obstacles);
    placements.forEach((placement, index) => {
      this.trailAnchors.push({
        x: placement.x,
        z: placement.z,
        cardY: this.cardHeight(placement.floorY),
        entry: entries[index]!,
      });
    });
  }

  /**
   * Replaces the scattered asset's many small meshes with one
   * InstancedMesh per unique geometry+material pair — the boulder field
   * drops from ~180 draw calls (×2 with the shadow pass) to a handful.
   * Originals are hidden, not disposed: the AssetManager still owns them.
   */
  private instanceScatter(root: THREE.Object3D): void {
    const groups = new Map<
      string,
      { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[] }
    >();

    for (const mesh of this.collectMeshes(root)) {
      if (!mesh.visible || Array.isArray(mesh.material)) continue;
      const key = `${mesh.geometry.uuid}/${mesh.material.uuid}`;
      let group = groups.get(key);
      if (!group) {
        group = { geometry: mesh.geometry, material: mesh.material, matrices: [] };
        groups.set(key, group);
      }
      mesh.updateWorldMatrix(true, false);
      group.matrices.push(mesh.matrixWorld.clone());
      mesh.visible = false;
    }

    const instancedRoot = new THREE.Group();
    instancedRoot.name = 'scatter-instanced';
    for (const { geometry, material, matrices } of groups.values()) {
      const instanced = new THREE.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((matrix, index) => instanced.setMatrixAt(index, matrix));
      instanced.instanceMatrix.needsUpdate = true;
      instanced.computeBoundingSphere();
      instanced.castShadow = true;
      instanced.receiveShadow = true;
      instancedRoot.add(instanced);
      this.ownedInstances.push(instanced);
    }
    this.group.add(instancedRoot);
  }

  /**
   * A second ring of honoured stones on the summit platform, flanking
   * the inscription wall in two wings so the plaque stays readable.
   */
  private buildSummitStones(entries: readonly MemorialEntry[]): void {
    if (entries.length === 0 || !this.memorial) return;

    const { radius, arcDegrees, centerGapDegrees } = memorialConfig.summitStones;
    const { center, platformTop } = this.memorial.summit;
    const wallBearing = memorialConfig.approachBearing + Math.PI;

    const count = entries.length;
    const arc = THREE.MathUtils.degToRad(arcDegrees);
    const gap = Math.min(THREE.MathUtils.degToRad(centerGapDegrees), arc * 0.6);
    const leftCount = Math.ceil(count / 2);
    const rightCount = count - leftCount;
    const wingSpan = (arc - gap) / 2;

    const placements: StonePlacement[] = [];
    const place = (offset: number): void => {
      const bearing = wallBearing + offset;
      const x = center.x + Math.sin(bearing) * radius;
      const z = center.z + Math.cos(bearing) * radius;
      placements.push({ x, z, floorY: platformTop, facing: bearing + Math.PI });
    };
    for (let i = 0; i < leftCount; i += 1) {
      place(-arc / 2 + (leftCount > 1 ? (i * wingSpan) / (leftCount - 1) : wingSpan / 2));
    }
    for (let i = 0; i < rightCount; i += 1) {
      place(gap / 2 + (rightCount > 1 ? (i * wingSpan) / (rightCount - 1) : wingSpan / 2));
    }

    this.summitStones = new MemorialStones(entries, placements, memorialConfig.stones);
    this.group.add(this.summitStones.group);
    this.walkObstacles.push(...this.summitStones.obstacles);
    placements.forEach((placement, index) => {
      this.trailAnchors.push({
        x: placement.x,
        z: placement.z,
        cardY: this.cardHeight(placement.floorY),
        entry: entries[index]!,
      });
    });
  }

  /** Hides scattered meshes near a polyline and removes their obstacles. */
  private clearScatterAlongTrail(points: readonly THREE.Vector2[], width: number): void {
    const distanceToTrail = (x: number, z: number): number => {
      let best = Infinity;
      const p = new THREE.Vector2(x, z);
      const closest = new THREE.Vector2();
      for (let i = 0; i < points.length - 1; i += 1) {
        const line = new THREE.Line3(
          new THREE.Vector3(points[i]!.x, 0, points[i]!.y),
          new THREE.Vector3(points[i + 1]!.x, 0, points[i + 1]!.y),
        );
        const nearest = line.closestPointToPoint(new THREE.Vector3(p.x, 0, p.y), true, new THREE.Vector3());
        best = Math.min(best, closest.set(nearest.x, nearest.z).distanceTo(p));
      }
      return best;
    };

    const bounds = new THREE.Box3();
    const boxCenter = new THREE.Vector3();
    if (this.rocksRoot) {
      for (const mesh of this.collectMeshes(this.rocksRoot)) {
        if (!mesh.visible) continue;
        bounds.setFromObject(mesh);
        if (bounds.isEmpty()) continue;
        bounds.getCenter(boxCenter);
        if (distanceToTrail(boxCenter.x, boxCenter.z) < width) {
          mesh.visible = false;
        }
      }
    }

    for (let i = this.walkObstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = this.walkObstacles[i]!;
      if (distanceToTrail(obstacle.x, obstacle.z) < width + obstacle.radius * 0.5) {
        this.walkObstacles.splice(i, 1);
      }
    }
  }

  /** Hides scattered meshes near a point and removes their obstacles. */
  private clearScatter(
    root: THREE.Object3D,
    center: readonly [number, number],
    radius: number,
  ): void {
    const bounds = new THREE.Box3();
    const boxCenter = new THREE.Vector3();
    const [cx, cz] = center;

    for (const mesh of this.collectMeshes(root)) {
      if (!mesh.visible) continue;
      bounds.setFromObject(mesh);
      if (bounds.isEmpty()) continue;
      bounds.getCenter(boxCenter);
      if (Math.hypot(boxCenter.x - cx, boxCenter.z - cz) < radius) {
        mesh.visible = false;
      }
    }

    for (let i = this.walkObstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = this.walkObstacles[i]!;
      if (Math.hypot(obstacle.x - cx, obstacle.z - cz) < radius) {
        this.walkObstacles.splice(i, 1);
      }
    }
  }

  private collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object);
    });
    return meshes;
  }

  /** Raycasts straight down against walkable surfaces; null when nothing is hit. */
  groundHeightAt(x: number, z: number): number | null {
    if (this.walkables.length === 0) return null;
    this.rayOrigin.set(x, RAY_ORIGIN_HEIGHT, z);
    this.raycaster.set(this.rayOrigin, DOWN);
    const hit = this.raycaster.intersectObjects(this.walkables, true)[0];
    return hit ? hit.point.y : null;
  }

  /**
   * The world is static: bake matrices once and stop per-frame matrix
   * recomputation for the whole hierarchy.
   */
  private freezeTransforms(): void {
    this.group.updateMatrixWorld(true);
    this.group.traverse((object) => {
      object.matrixAutoUpdate = false;
    });
  }

  dispose(): void {
    this.summitStones?.dispose();
    this.summitStones = null;
    this.trailStones?.dispose();
    this.trailStones = null;
    this.trailAnchors.length = 0;
    this.memorial?.dispose();
    this.memorial = null;
    this.atmosphere?.dispose();
    this.atmosphere = null;
    this.lighting?.dispose();
    this.lighting = null;
    this.walkables.length = 0;
    this.rocksRoot = null;
    if (this.terrain) {
      disposeBoundsTrees(this.terrain);
      this.terrain = null;
    }
    this.ownedMaterials.forEach((material) => material.dispose());
    this.ownedMaterials.length = 0;
    // Instance buffers only — geometry/material belong to the asset cache.
    this.ownedInstances.forEach((instanced) => instanced.dispose());
    this.ownedInstances.length = 0;
    this.group.removeFromParent();
    this.group.clear();
  }
}
