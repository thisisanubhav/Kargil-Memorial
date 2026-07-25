import { EventEmitter } from '@/utils/EventEmitter';

export interface ViewportSize {
  width: number;
  height: number;
  pixelRatio: number;
}

interface ResizeEvents extends Record<string, unknown> {
  resize: ViewportSize;
}

/**
 * Tracks viewport dimensions and device pixel ratio (including monitor
 * changes) and broadcasts a single normalized resize event.
 */
export class ResizeManager extends EventEmitter<ResizeEvents> {
  private readonly maxPixelRatio: number;
  private dprQuery: MediaQueryList | null = null;

  constructor(maxPixelRatio: number) {
    super();
    this.maxPixelRatio = maxPixelRatio;
    window.addEventListener('resize', this.handleResize);
    this.watchPixelRatio();
  }

  get size(): ViewportSize {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: Math.min(window.devicePixelRatio, this.maxPixelRatio),
    };
  }

  private readonly handleResize = (): void => {
    this.emit('resize', this.size);
  };

  private readonly handlePixelRatioChange = (): void => {
    this.watchPixelRatio();
    this.emit('resize', this.size);
  };

  private watchPixelRatio(): void {
    this.dprQuery?.removeEventListener('change', this.handlePixelRatioChange);
    this.dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    this.dprQuery.addEventListener('change', this.handlePixelRatioChange);
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    this.dprQuery?.removeEventListener('change', this.handlePixelRatioChange);
    this.dprQuery = null;
    this.removeAllListeners();
  }
}
