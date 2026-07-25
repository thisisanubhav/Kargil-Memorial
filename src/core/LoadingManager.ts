import * as THREE from 'three';
import { EventEmitter } from '@/utils/EventEmitter';

export interface LoadingProgress {
  /** Weighted 0–1 progress across every tracked item. */
  ratio: number;
  /** Label of the item that most recently reported progress. */
  itemLabel: string;
}

export interface LoadingFailure {
  itemLabel: string;
  message: string;
}

interface LoadingEvents extends Record<string, unknown> {
  progress: LoadingProgress;
  complete: void;
  error: LoadingFailure;
}

interface TrackedItem {
  label: string;
  weight: number;
  ratio: number;
  done: boolean;
}

/**
 * Aggregates loading progress across all requested assets and exposes it
 * as typed events, so UI never touches loader internals.
 *
 * THREE.LoadingManager only ticks once per completed item, which reads
 * terribly with multi-megabyte files — so items report their own byte
 * ratio here and the aggregate is weighted by approximate asset size.
 * The wrapped THREE.LoadingManager is still shared with every loader so
 * sub-resources (textures inside a glTF) stay on the same pipeline.
 */
export class AppLoadingManager extends EventEmitter<LoadingEvents> {
  readonly manager = new THREE.LoadingManager();

  private readonly items = new Map<string, TrackedItem>();
  private completeEmitted = false;

  /** Registers an item before it starts downloading. */
  track(key: string, label: string, weight: number): void {
    this.items.set(key, { label, weight: Math.max(weight, 0.01), ratio: 0, done: false });
    this.completeEmitted = false;
  }

  /** Reports byte-level download progress (0–1) for a tracked item. */
  report(key: string, ratio: number): void {
    const item = this.items.get(key);
    if (!item || item.done) return;
    item.ratio = Math.min(Math.max(ratio, 0), 1);
    this.emitProgress(item.label);
  }

  markDone(key: string): void {
    const item = this.items.get(key);
    if (!item || item.done) return;
    item.done = true;
    item.ratio = 1;
    this.emitProgress(item.label);

    if (!this.completeEmitted && [...this.items.values()].every((entry) => entry.done)) {
      this.completeEmitted = true;
      this.emit('complete', undefined);
    }
  }

  markFailed(key: string, message: string): void {
    const item = this.items.get(key);
    this.emit('error', { itemLabel: item?.label ?? key, message });
  }

  get ratio(): number {
    let weighted = 0;
    let totalWeight = 0;
    for (const item of this.items.values()) {
      weighted += item.ratio * item.weight;
      totalWeight += item.weight;
    }
    return totalWeight > 0 ? weighted / totalWeight : 0;
  }

  private emitProgress(itemLabel: string): void {
    this.emit('progress', { ratio: this.ratio, itemLabel });
  }

  dispose(): void {
    this.items.clear();
    this.removeAllListeners();
  }
}
