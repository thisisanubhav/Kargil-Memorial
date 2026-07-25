import * as THREE from 'three';
import { memorialConfig, type MemorialConfig } from '@/config/memorial';
import { summitConfig } from '@/config/summit';
import type { CircleObstacle } from '@/controls/VisitorControls';
import type { MemorialData } from '@/data/memorialData';
import type { WindUniforms } from '@/world/atmosphere/wind';
import { FlagAnimator } from '@/world/animation/FlagAnimator';
import { Flame } from './Flame';
import {
  createDedicationTexture,
  createFlagTexture,
  createPlaqueTexture,
  createStoneTexture,
} from './textures';

export interface MemorialContext {
  groundHeightAt(x: number, z: number): number | null;
  readonly wind: WindUniforms;
  /** All memorial text — the wall inscription and the honoured entries. */
  readonly data: MemorialData;
}

/**
 * The summit memorial, constructed entirely from procedural geometry and
 * canvas textures: a two-tier stone platform set into the knoll, stairs
 * descending toward the approach, the flagpole and Tricolour, an eternal
 * flame, and a low memorial wall with an inscription. Simple, civic,
 * quiet architecture.
 *
 * Exposes its walkable surfaces (platform, stairs) so the ground query
 * can carry the visitor up to the flame, and circle obstacles for the
 * pole and flame bowl.
 */
export class Memorial {
  readonly group = new THREE.Group();
  readonly walkables: THREE.Object3D[] = [];
  readonly obstacles: CircleObstacle[] = [];
  /** Where the summit platform stands and where the flag cloth flies. */
  readonly summit = {
    center: new THREE.Vector3(),
    platformTop: 0,
    flagFocus: new THREE.Vector3(),
  };

  private readonly config: MemorialConfig;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly lights: Array<THREE.Light & { dispose(): void }> = [];
  private flame: Flame | null = null;
  private flagSpot: THREE.SpotLight | null = null;

  private stoneMaterial!: THREE.MeshStandardMaterial;

  constructor(config: MemorialConfig = memorialConfig) {
    this.config = config;
    this.group.name = 'memorial';
  }

  build(context: MemorialContext): void {
    const [cx, cz] = this.config.center;
    const bearing = this.config.approachBearing;
    const dir = new THREE.Vector2(Math.sin(bearing), Math.cos(bearing));

    // Found the platform on the HIGHEST ground under its footprint — on a
    // hillside, basing it on the centre alone would let the slope overtop
    // the platform and bury the wall.
    let ground = context.groundHeightAt(cx, cz) ?? 0;
    let lowestGround = ground;
    const ringRadius = this.config.platform.lowerRadius;
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const sample = context.groundHeightAt(
        cx + Math.sin(angle) * ringRadius,
        cz + Math.cos(angle) * ringRadius,
      );
      if (sample !== null) {
        ground = Math.max(ground, sample);
        lowestGround = Math.min(lowestGround, sample);
      }
    }

    const stoneTexture = createStoneTexture();
    stoneTexture.repeat.set(3, 3);
    this.textures.push(stoneTexture);
    this.stoneMaterial = new THREE.MeshStandardMaterial({
      map: stoneTexture,
      roughness: 0.95,
      metalness: 0.02,
    });
    this.materials.push(this.stoneMaterial);

    const lowerTop = ground + this.config.platform.lowerTop;
    const upperTop = lowerTop + this.config.platform.upperHeight;

    this.buildPlatform(cx, cz, lowestGround, lowerTop);
    this.buildStairs(cx, cz, lowerTop, dir, context);
    this.buildWall(cx, cz, lowerTop, bearing, context.data.plaque.lines);
    this.buildPoleAndFlag(cx, cz, upperTop, context.wind);
    this.buildFlame(cx, cz, upperTop, dir);
    if (context.data.fallen) {
      this.buildDedication(cx, cz, upperTop, bearing, context.data.fallen.lines);
    }
    this.buildLighting(cx, cz, upperTop, dir);

    this.summit.center.set(cx, upperTop, cz);
    this.summit.platformTop = upperTop;
    this.summit.flagFocus.set(
      cx,
      upperTop + this.config.pole.height - this.config.flag.dropFromTop,
      cz,
    );
  }

  /**
   * Blooms the warmth around the eternal flame and the Tricolour —
   * called with an eased 0–1 mix during the summit arrival; the warmth
   * remains for the rest of the visit.
   */
  setWarmth(mix: number): void {
    const { flameBoost, flameReach, flameScale, spotBoost } = summitConfig.warmth;
    this.flame?.setWarmth(mix, flameBoost, flameReach, flameScale);
    if (this.flagSpot) {
      this.flagSpot.intensity =
        this.config.flagLight.intensity * (1 + (spotBoost - 1) * mix);
    }
  }

  private buildPlatform(cx: number, cz: number, ground: number, lowerTop: number): void {
    const { lowerRadius, upperRadius, upperHeight, sink } = this.config.platform;

    const lowerHeight = lowerTop - ground + sink;
    const lower = new THREE.CylinderGeometry(lowerRadius, lowerRadius + 0.35, lowerHeight, 48);
    this.geometries.push(lower);
    const lowerMesh = new THREE.Mesh(lower, this.stoneMaterial);
    lowerMesh.position.set(cx, lowerTop - lowerHeight / 2, cz);

    const upper = new THREE.CylinderGeometry(upperRadius, upperRadius + 0.12, upperHeight, 48);
    this.geometries.push(upper);
    const upperMesh = new THREE.Mesh(upper, this.stoneMaterial);
    upperMesh.position.set(cx, lowerTop + upperHeight / 2, cz);

    for (const mesh of [lowerMesh, upperMesh]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.walkables.push(mesh);
    }
  }

  private buildStairs(
    cx: number,
    cz: number,
    lowerTop: number,
    dir: THREE.Vector2,
    context: MemorialContext,
  ): void {
    const { width, rise, run, maxSteps } = this.config.stairs;
    const { lowerRadius } = this.config.platform;

    const transforms: THREE.Matrix4[] = [];
    const rotation = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.config.approachBearing,
    );

    for (let i = 0; i < maxSteps; i += 1) {
      const distance = lowerRadius + (i + 0.5) * run - 0.08;
      const x = cx + dir.x * distance;
      const z = cz + dir.y * distance;
      const top = lowerTop - (i + 1) * rise;

      const stepGround = context.groundHeightAt(x, z);
      if (stepGround !== null && top <= stepGround + 0.04) break;

      transforms.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, top - 0.09, z),
          rotation,
          new THREE.Vector3(1, 1, 1),
        ),
      );
    }

    if (transforms.length === 0) return;

    const stepGeometry = new THREE.BoxGeometry(width, 0.18, run + 0.1);
    this.geometries.push(stepGeometry);
    const steps = new THREE.InstancedMesh(stepGeometry, this.stoneMaterial, transforms.length);
    transforms.forEach((matrix, index) => steps.setMatrixAt(index, matrix));
    steps.instanceMatrix.needsUpdate = true;
    steps.castShadow = true;
    steps.receiveShadow = true;
    this.group.add(steps);
    this.walkables.push(steps);
  }

  private buildWall(
    cx: number,
    cz: number,
    lowerTop: number,
    bearing: number,
    plaqueLines: readonly string[],
  ): void {
    const { innerRadius, thickness, height, arcDegrees } = this.config.wall;
    const outerRadius = innerRadius + thickness;
    const halfArc = THREE.MathUtils.degToRad(arcDegrees / 2);
    // The extruded shape lives in XY and is rotated flat; shape angle phi
    // maps to world bearing theta = phi + PI/2.
    const wallBearing = bearing + Math.PI;
    const phiCenter = wallBearing - Math.PI / 2;

    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerRadius, phiCenter - halfArc, phiCenter + halfArc, false);
    shape.absarc(0, 0, innerRadius, phiCenter + halfArc, phiCenter - halfArc, true);
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    this.geometries.push(geometry);
    const wall = new THREE.Mesh(geometry, this.stoneMaterial);
    wall.rotation.x = -Math.PI / 2;
    wall.position.set(cx, lowerTop, cz);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.group.add(wall);

    // Plaque on the inner face, looking back at the platform.
    const plaqueTexture = createPlaqueTexture(plaqueLines);
    this.textures.push(plaqueTexture);
    const plaqueMaterial = new THREE.MeshStandardMaterial({
      map: plaqueTexture,
      roughness: 0.6,
      metalness: 0.15,
    });
    this.materials.push(plaqueMaterial);

    const plaqueGeometry = new THREE.PlaneGeometry(this.config.plaque.width, this.config.plaque.height);
    this.geometries.push(plaqueGeometry);
    const plaque = new THREE.Mesh(plaqueGeometry, plaqueMaterial);
    const inset = innerRadius - 0.02;
    plaque.position.set(
      cx + Math.sin(wallBearing) * inset,
      lowerTop + height * 0.52,
      cz + Math.cos(wallBearing) * inset,
    );
    plaque.rotation.y = wallBearing + Math.PI;
    plaque.receiveShadow = true;
    this.group.add(plaque);
  }

  private buildPoleAndFlag(cx: number, cz: number, upperTop: number, wind: WindUniforms): void {
    const { height, radiusBottom, radiusTop } = this.config.pole;
    const flagGroup = new THREE.Group();
    flagGroup.position.set(cx, upperTop, cz);

    const poleMaterial = new THREE.MeshStandardMaterial({
      color: 0x9aa0a8,
      roughness: 0.35,
      metalness: 0.85,
    });
    this.materials.push(poleMaterial);

    const poleGeometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 16);
    poleGeometry.translate(0, height / 2, 0);
    this.geometries.push(poleGeometry);
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.castShadow = true;
    flagGroup.add(pole);

    const finialGeometry = new THREE.SphereGeometry(0.16, 16, 12);
    this.geometries.push(finialGeometry);
    const finial = new THREE.Mesh(finialGeometry, poleMaterial);
    finial.position.y = height + 0.1;
    flagGroup.add(finial);

    const flagTexture = createFlagTexture();
    this.textures.push(flagTexture);
    const clothMaterial = new THREE.MeshStandardMaterial({
      map: flagTexture,
      roughness: 0.85,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    this.materials.push(clothMaterial);

    const { width: flagWidth, height: flagHeight, dropFromTop } = this.config.flag;
    const clothGeometry = new THREE.PlaneGeometry(flagWidth, flagHeight, 48, 32);
    // Shift so the hoist edge sits just off the pole — the animator ramps
    // its wave from this pinned edge to the free edge.
    clothGeometry.translate(flagWidth / 2 + radiusTop + 0.04, 0, 0);
    this.geometries.push(clothGeometry);
    const cloth = new THREE.Mesh(clothGeometry, clothMaterial);
    cloth.position.y = height - dropFromTop;
    cloth.castShadow = true;
    flagGroup.add(cloth);

    this.group.add(flagGroup);
    new FlagAnimator(flagGroup, wind, this.config.flag.waveStrength);

    this.obstacles.push({ x: cx, z: cz, radius: 0.4 });
  }

  private buildFlame(cx: number, cz: number, upperTop: number, dir: THREE.Vector2): void {
    const distance = this.config.flame.distanceFromPole;
    const x = cx + dir.x * distance;
    const z = cz + dir.y * distance;

    const bowlMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d4148,
      roughness: 0.8,
      metalness: 0.1,
    });
    this.materials.push(bowlMaterial);

    const pedestalGeometry = new THREE.CylinderGeometry(0.42, 0.55, 0.55, 24);
    this.geometries.push(pedestalGeometry);
    const pedestal = new THREE.Mesh(pedestalGeometry, bowlMaterial);
    pedestal.position.set(x, upperTop + 0.275, z);
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    this.group.add(pedestal);

    const bowlProfile: THREE.Vector2[] = [
      new THREE.Vector2(0.1, 0),
      new THREE.Vector2(0.55, 0.06),
      new THREE.Vector2(0.68, 0.22),
      new THREE.Vector2(0.6, 0.3),
      new THREE.Vector2(0.34, 0.24),
      new THREE.Vector2(0.1, 0.2),
    ];
    const bowlGeometry = new THREE.LatheGeometry(bowlProfile, 28);
    this.geometries.push(bowlGeometry);
    const bowl = new THREE.Mesh(bowlGeometry, bowlMaterial);
    bowl.position.set(x, upperTop + 0.55, z);
    bowl.castShadow = true;
    this.group.add(bowl);

    this.flame = new Flame(this.config.flame.light);
    this.flame.group.position.set(x, upperTop + 0.72, z);
    this.group.add(this.flame.group);

    this.obstacles.push({ x, z, radius: 1.0 });
  }

  /**
   * The engraved tablet standing behind the flag pole, facing the
   * approach — the collective dedication to every soldier who fell.
   */
  private buildDedication(
    cx: number,
    cz: number,
    upperTop: number,
    bearing: number,
    lines: readonly string[],
  ): void {
    const { distanceBehindPole, width, height, tilt } = this.config.dedication;
    const x = cx - Math.sin(bearing) * distanceBehindPole;
    const z = cz - Math.cos(bearing) * distanceBehindPole;

    const baseGeometry = new THREE.BoxGeometry(width + 0.3, 0.16, 0.6);
    this.geometries.push(baseGeometry);
    const base = new THREE.Mesh(baseGeometry, this.stoneMaterial);
    base.position.set(x, upperTop + 0.08, z);
    base.rotation.y = bearing;
    base.castShadow = true;
    base.receiveShadow = true;
    this.group.add(base);

    const slabGeometry = new THREE.BoxGeometry(width, height, 0.14);
    this.geometries.push(slabGeometry);
    const slab = new THREE.Mesh(slabGeometry, this.stoneMaterial);
    slab.position.set(x, upperTop + 0.16 + height / 2 - 0.03, z);
    slab.rotation.set(tilt, bearing, 0, 'YXZ');
    slab.castShadow = true;
    slab.receiveShadow = true;
    this.group.add(slab);

    const texture = createDedicationTexture(lines);
    this.textures.push(texture);
    const faceMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.6,
      metalness: 0.12,
    });
    this.materials.push(faceMaterial);

    const faceGeometry = new THREE.PlaneGeometry(width - 0.16, height - 0.14);
    faceGeometry.translate(0, 0, 0.075);
    this.geometries.push(faceGeometry);
    const face = new THREE.Mesh(faceGeometry, faceMaterial);
    face.position.copy(slab.position);
    face.rotation.copy(slab.rotation);
    face.receiveShadow = true;
    this.group.add(face);

    this.obstacles.push({ x, z, radius: Math.max(1.0, width / 2) });
  }

  private buildLighting(cx: number, cz: number, upperTop: number, dir: THREE.Vector2): void {
    const config = this.config.flagLight;
    const spot = new THREE.SpotLight(
      config.color,
      config.intensity,
      config.distance,
      config.angle,
      config.penumbra,
      2,
    );
    spot.position.set(
      cx + dir.x * (this.config.platform.upperRadius - 0.6),
      upperTop + 0.3,
      cz + dir.y * (this.config.platform.upperRadius - 0.6),
    );
    spot.target.position.set(cx, upperTop + this.config.pole.height - 1.2, cz);
    this.group.add(spot, spot.target);
    this.lights.push(spot);
    this.flagSpot = spot;
  }

  update(delta: number): void {
    this.flame?.update(delta);
  }

  dispose(): void {
    this.flame?.dispose();
    this.flame = null;
    this.lights.forEach((light) => light.dispose());
    this.lights.length = 0;
    this.geometries.forEach((geometry) => geometry.dispose());
    this.geometries.length = 0;
    this.materials.forEach((material) => material.dispose());
    this.materials.length = 0;
    this.textures.forEach((texture) => texture.dispose());
    this.textures.length = 0;
    this.walkables.length = 0;
    this.obstacles.length = 0;
    this.group.removeFromParent();
    this.group.clear();
  }
}
