import * as THREE from 'three';
import type { LoopConfig } from '@/config/types';

export type UpdateCallback = (delta: number, elapsed: number) => void;

/**
 * Drives the frame loop with a clamped delta so a backgrounded tab or a
 * long stall never produces a huge simulation step. Subscribers are called
 * in registration order; rendering is just the last subscriber.
 */
export class AnimationLoop {
  private readonly clock = new THREE.Clock(false);
  private readonly callbacks = new Set<UpdateCallback>();
  private readonly maxDelta: number;
  private rafId: number | null = null;
  private running = false;

  constructor(config: LoopConfig) {
    this.maxDelta = config.maxDelta;
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  subscribe(callback: UpdateCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    this.clock.stop();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private readonly tick = (): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    const delta = Math.min(this.clock.getDelta(), this.maxDelta);
    const elapsed = this.clock.elapsedTime;
    this.callbacks.forEach((callback) => callback(delta, elapsed));
  };

  private readonly handleVisibility = (): void => {
    // Discard the time accumulated while hidden so the first visible frame
    // does not receive it as one giant delta.
    if (document.visibilityState === 'visible' && this.running) {
      this.clock.getDelta();
    }
  };

  dispose(): void {
    this.stop();
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.callbacks.clear();
  }
}
