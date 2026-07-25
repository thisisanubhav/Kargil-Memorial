import * as THREE from 'three';
import { controlsConfig, type ControlsConfig } from '@/config/controls';

export interface CircleObstacle {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}

export interface WalkableWorld {
  groundHeightAt(x: number, z: number): number | null;
  readonly obstacles: readonly CircleObstacle[];
}

const FORWARD_KEYS = new Set(['KeyW', 'ArrowUp']);
const BACK_KEYS = new Set(['KeyS', 'ArrowDown']);
const LEFT_KEYS = new Set(['KeyA', 'ArrowLeft']);
const RIGHT_KEYS = new Set(['KeyD', 'ArrowRight']);

/** Frame-rate-independent exponential approach. */
function damp(current: number, target: number, tau: number, delta: number): number {
  return target + (current - target) * Math.exp(-delta / tau);
}

/**
 * First-person visitor movement: pointer-lock look, WASD/arrow walking
 * with eased acceleration and deceleration, terrain-following eye height,
 * circle-based rock collision with sliding, a slope limit so ridge walls
 * stay unclimbable, and a gentle walk bob. Walking only — the pace of a
 * visitor, not a player.
 */
export class VisitorControls {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLElement;
  private readonly world: WalkableWorld;
  private readonly config: ControlsConfig;

  private readonly pressed = new Set<string>();
  private locked = false;

  private yaw = 0;
  private pitch = 0;
  private targetYaw = 0;
  private targetPitch = 0;

  private readonly position = new THREE.Vector3();
  private readonly velocity = new THREE.Vector2();
  // Scratch objects reused every frame — the walk loop allocates nothing.
  private readonly scratchInput = new THREE.Vector2();
  private readonly scratchTarget = new THREE.Vector2();
  private readonly scratchEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private smoothedGround = 0;
  private bobPhase = 0;
  private bobStrength = 0;
  private readonly bobEnabled: boolean;

  private disposed = false;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    world: WalkableWorld,
    config: ControlsConfig = controlsConfig,
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.world = world;
    this.config = config;
    this.bobEnabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    domElement.addEventListener('click', this.requestLock);
    document.addEventListener('pointerlockchange', this.handleLockChange);
    document.addEventListener('pointerlockerror', this.handleLockError);
    document.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clearInput);
  }

  /** Current horizontal speed in m/s. */
  get currentSpeed(): number {
    return this.velocity.length();
  }

  /** Smoothed ground height under the visitor's feet. */
  get groundHeight(): number {
    return this.smoothedGround;
  }

  /** Configured full walking speed. */
  get walkSpeed(): number {
    return this.config.walkSpeed;
  }

  /** Adopts the camera's current position and orientation as the start state. */
  syncFromCamera(): void {
    this.position.copy(this.camera.position);
    const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = this.targetYaw = euler.y;
    this.pitch = this.targetPitch = euler.x;

    const ground = this.world.groundHeightAt(this.position.x, this.position.z);
    this.smoothedGround = ground ?? this.position.y - this.config.eyeHeight;
  }

  update(delta: number): void {
    this.updateLook(delta);
    this.updateWalk(delta);
    this.applyCamera(delta);
  }

  private updateLook(delta: number): void {
    this.yaw = damp(this.yaw, this.targetYaw, this.config.lookTau, delta);
    this.pitch = damp(this.pitch, this.targetPitch, this.config.lookTau, delta);
  }

  private updateWalk(delta: number): void {
    const input = this.scratchInput.set(
      (this.isDown(RIGHT_KEYS) ? 1 : 0) - (this.isDown(LEFT_KEYS) ? 1 : 0),
      (this.isDown(BACK_KEYS) ? 1 : 0) - (this.isDown(FORWARD_KEYS) ? 1 : 0),
    );

    const target = this.scratchTarget.set(0, 0);
    if (this.locked && input.lengthSq() > 0) {
      input.normalize();
      // Rotate the local input into world space around the yaw.
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      target.set(
        (input.x * cos + input.y * sin) * this.config.walkSpeed,
        (input.y * cos - input.x * sin) * this.config.walkSpeed,
      );
    }

    const tau = target.lengthSq() > 0 ? this.config.accelTau : this.config.decelTau;
    this.velocity.x = damp(this.velocity.x, target.x, tau, delta);
    this.velocity.y = damp(this.velocity.y, target.y, tau, delta);
    if (this.velocity.lengthSq() < 1e-6) this.velocity.set(0, 0);

    const stepX = this.velocity.x * delta;
    const stepZ = this.velocity.y * delta;
    if (stepX === 0 && stepZ === 0) return;

    // Try the full step; if the ground refuses it, slide axis by axis.
    if (!this.tryMove(stepX, stepZ)) {
      const movedX = this.tryMove(stepX, 0);
      const movedZ = this.tryMove(0, stepZ);
      if (!movedX) this.velocity.x = 0;
      if (!movedZ) this.velocity.y = 0;
    }

    this.resolveObstacles();
  }

  /** Returns false when the candidate is off-terrain, too steep, or out of bounds. */
  private tryMove(dx: number, dz: number): boolean {
    if (dx === 0 && dz === 0) return false;
    const nx = this.position.x + dx;
    const nz = this.position.z + dz;

    if (Math.hypot(nx, nz) > this.config.walkBounds) return false;

    const groundHere = this.world.groundHeightAt(this.position.x, this.position.z);
    const groundThere = this.world.groundHeightAt(nx, nz);
    if (groundThere === null) return false;

    if (groundHere !== null) {
      // Slope is sampled a stride ahead, not across this frame's tiny
      // step — otherwise a single stair riser would read as a wall.
      const run = Math.hypot(dx, dz);
      const probe = this.config.slopeProbeDistance;
      const probeGround = this.world.groundHeightAt(
        this.position.x + (dx / run) * probe,
        this.position.z + (dz / run) * probe,
      );
      const aheadGround = probeGround ?? groundThere;
      const aheadRun = probeGround !== null ? probe : Math.max(run, 0.05);
      if ((aheadGround - groundHere) / aheadRun > this.config.maxSlope) return false;
    }

    this.position.x = nx;
    this.position.z = nz;
    return true;
  }

  /** Pushes the visitor out of any boulder circle, sliding along its rim. */
  private resolveObstacles(): void {
    const bodyRadius = this.config.bodyRadius;
    for (const obstacle of this.world.obstacles) {
      const dx = this.position.x - obstacle.x;
      const dz = this.position.z - obstacle.z;
      const minDist = obstacle.radius + bodyRadius;
      const distSq = dx * dx + dz * dz;
      if (distSq >= minDist * minDist || distSq < 1e-9) continue;

      const dist = Math.sqrt(distSq);
      const push = (minDist - dist) / dist;
      this.position.x += dx * push;
      this.position.z += dz * push;
    }
  }

  private applyCamera(delta: number): void {
    const ground = this.world.groundHeightAt(this.position.x, this.position.z);
    if (ground !== null) {
      this.smoothedGround = damp(this.smoothedGround, ground, this.config.groundTau, delta);
    }

    const speed = this.velocity.length();
    const speedRatio = Math.min(speed / this.config.walkSpeed, 1);
    this.bobStrength = damp(this.bobStrength, speedRatio, 0.25, delta);

    let bobY = 0;
    let bobX = 0;
    if (this.bobEnabled) {
      this.bobPhase += speed * delta * this.config.bob.frequency;
      bobY = Math.sin(this.bobPhase) * this.config.bob.amplitude * this.bobStrength;
      bobX = Math.sin(this.bobPhase * 0.5) * this.config.bob.amplitude * 0.6 * this.bobStrength;
    }

    this.position.y = this.smoothedGround + this.config.eyeHeight;

    this.scratchEuler.set(this.pitch, this.yaw, 0);
    this.camera.quaternion.setFromEuler(this.scratchEuler);
    this.camera.position.copy(this.position);
    this.camera.position.y += bobY;
    // Lateral sway along the camera's right axis.
    this.camera.position.x += Math.cos(this.yaw) * bobX;
    this.camera.position.z -= Math.sin(this.yaw) * bobX;
  }

  private isDown(keys: ReadonlySet<string>): boolean {
    for (const key of keys) {
      if (this.pressed.has(key)) return true;
    }
    return false;
  }

  private readonly requestLock = (): void => {
    if (!this.locked && !this.disposed) {
      this.domElement.requestPointerLock();
    }
  };

  private readonly handleLockChange = (): void => {
    this.locked = document.pointerLockElement === this.domElement;
    if (!this.locked) this.clearInput();
  };

  private readonly handleLockError = (): void => {
    console.warn('[kargil] pointer lock was refused by the browser');
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (!this.locked) return;
    this.targetYaw -= event.movementX * this.config.lookSensitivity;
    this.targetPitch -= event.movementY * this.config.lookSensitivity;
    this.targetPitch = THREE.MathUtils.clamp(
      this.targetPitch,
      -this.config.pitchLimit,
      this.config.pitchLimit,
    );
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.locked) return;
    this.pressed.add(event.code);
    if (event.code.startsWith('Arrow')) event.preventDefault();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code);
  };

  private readonly clearInput = (): void => {
    this.pressed.clear();
  };

  dispose(): void {
    this.disposed = true;
    this.domElement.removeEventListener('click', this.requestLock);
    document.removeEventListener('pointerlockchange', this.handleLockChange);
    document.removeEventListener('pointerlockerror', this.handleLockError);
    document.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.clearInput);
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }
}
