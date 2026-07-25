/**
 * Controls the loading overlay that is authored directly in index.html so
 * it paints before any JavaScript executes. This class only updates and
 * dismisses it — layout and animation live in CSS.
 */
export class LoadingScreen {
  private readonly root: HTMLElement;
  private readonly content: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly percent: HTMLElement;
  private readonly status: HTMLElement;
  private failed = false;

  constructor() {
    this.root = this.require('#loading-screen');
    this.content = this.require('#loading-screen .loading-content');
    this.bar = this.require('#loading-screen .loading-bar');
    this.fill = this.require('#loading-screen .loading-bar-fill');
    this.percent = this.require('#loading-screen .loading-percent');
    this.status = this.require('#loading-screen .loading-status');
  }

  private require(selector: string): HTMLElement {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) {
      throw new Error(`LoadingScreen: missing required element "${selector}"`);
    }
    return element;
  }

  setProgress(ratio: number): void {
    if (this.failed) return;
    const percent = Math.round(Math.min(Math.max(ratio, 0), 1) * 100);
    this.fill.style.width = `${percent}%`;
    this.percent.textContent = `${percent}%`;
    this.bar.setAttribute('aria-valuenow', String(percent));
  }

  setStatus(message: string): void {
    if (this.failed) return;
    this.status.textContent = message;
  }

  /**
   * Replaces the loading UI with an error state. The overlay stays up:
   * the experience cannot continue without its assets.
   */
  showError(message: string): void {
    if (this.failed) return;
    this.failed = true;

    this.content.querySelectorAll('.loading-bar, .loading-percent, .loading-status').forEach((el) => {
      el.remove();
    });

    const alert = document.createElement('div');
    alert.className = 'loading-error';
    alert.setAttribute('role', 'alert');

    const text = document.createElement('p');
    text.className = 'loading-error-message';
    text.textContent = message;

    const retry = document.createElement('button');
    retry.className = 'loading-error-retry';
    retry.type = 'button';
    retry.textContent = 'Try again';
    retry.addEventListener('click', () => window.location.reload());

    alert.append(text, retry);
    this.content.appendChild(alert);
    retry.focus();
  }

  /** Fades the overlay out and removes it from the document. */
  hide(): Promise<void> {
    if (this.failed) return Promise.resolve();
    this.setProgress(1);
    this.status.textContent = '';

    return new Promise((resolve) => {
      const finish = (): void => {
        this.root.remove();
        resolve();
      };

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion) {
        finish();
        return;
      }

      // Brief hold at 100% so completion registers before the fade.
      window.setTimeout(() => {
        this.root.addEventListener('transitionend', finish, { once: true });
        // Safety net in case transitionend never fires (e.g. display: none).
        window.setTimeout(finish, 1600);
        this.root.classList.add('is-hidden');
      }, 350);
    });
  }
}
