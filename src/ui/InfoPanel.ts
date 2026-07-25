import type { MemorialEntry } from '@/data/memorialData';

const SWAP_DELAY_MS = 450;

/**
 * The quiet information card that accompanies each memorial stone. All
 * content comes from the data entry; this class only builds DOM and
 * choreographs the fades. The container is an aria-live region, so each
 * hero is announced to assistive technology as the visitor arrives.
 */
export class InfoPanel {
  private readonly root: HTMLElement;
  private current: MemorialEntry | null = null;
  private swapTimer: number | null = null;

  constructor() {
    const element = document.querySelector<HTMLElement>('#info-panel');
    if (!element) {
      throw new Error('InfoPanel: missing #info-panel element');
    }
    this.root = element;
  }

  present(entry: MemorialEntry): void {
    if (this.current === entry) return;

    const wasVisible = this.root.classList.contains('is-visible');
    this.current = entry;
    this.cancelSwap();

    if (wasVisible) {
      // Fade the old card out, then swap and fade back in.
      this.root.classList.remove('is-visible');
      this.swapTimer = window.setTimeout(() => {
        this.fill(entry);
        this.root.classList.add('is-visible');
      }, SWAP_DELAY_MS);
    } else {
      this.fill(entry);
      // Next frame, so the transition runs from the hidden state.
      requestAnimationFrame(() => {
        if (this.current === entry) this.root.classList.add('is-visible');
      });
    }
  }

  clear(): void {
    if (this.current === null) return;
    this.current = null;
    this.cancelSwap();
    this.root.classList.remove('is-visible');
  }

  private fill(entry: MemorialEntry): void {
    this.root.replaceChildren();

    const name = document.createElement('h2');
    name.className = 'info-name';
    name.textContent = entry.name;

    const meta = document.createElement('p');
    meta.className = 'info-meta';
    meta.textContent = `${entry.rank} · ${entry.award}`;

    const quote = document.createElement('blockquote');
    quote.className = 'info-quote';
    quote.textContent = `“${entry.quote}”`;

    const summary = document.createElement('p');
    summary.className = 'info-summary';
    summary.textContent = entry.summary;

    this.root.append(name, meta, quote, summary);
  }

  private cancelSwap(): void {
    if (this.swapTimer !== null) {
      window.clearTimeout(this.swapTimer);
      this.swapTimer = null;
    }
  }

  dispose(): void {
    this.cancelSwap();
    this.root.replaceChildren();
    this.root.classList.remove('is-visible');
  }
}
