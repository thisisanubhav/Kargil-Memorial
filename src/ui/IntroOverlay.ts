/**
 * DOM layer of the cinematic introduction: the black veil, the two
 * title lines and the skip hint. All fading is CSS transitions; this
 * class only flips classes at the cue times it is given.
 */
export class IntroOverlay {
  private readonly root: HTMLElement;
  private readonly veil: HTMLElement;
  private readonly lines: HTMLElement[];
  private readonly skipHint: HTMLElement;
  private removed = false;

  constructor() {
    const root = document.querySelector<HTMLElement>('#intro-overlay');
    if (!root) throw new Error('IntroOverlay: missing #intro-overlay element');
    this.root = root;
    this.veil = this.require('.intro-veil');
    this.lines = Array.from(root.querySelectorAll<HTMLElement>('.intro-line'));
    this.skipHint = this.require('.intro-skip');
  }

  private require(selector: string): HTMLElement {
    const element = this.root.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`IntroOverlay: missing "${selector}"`);
    return element;
  }

  /** Applies all cue states for the current timeline position. */
  applyCues(
    elapsed: number,
    cues: readonly { show: number; hide: number }[],
    veilFadeEnd: number,
    skipHintAt: number,
  ): void {
    if (this.removed) return;
    this.veil.classList.toggle('is-clear', elapsed > 0.05 || veilFadeEnd <= 0);
    this.lines.forEach((line, index) => {
      const cue = cues[index];
      line.classList.toggle('is-shown', !!cue && elapsed >= cue.show && elapsed < cue.hide);
    });
    this.skipHint.classList.toggle('is-shown', elapsed >= skipHintAt);
  }

  /** Rapid dip to black used when skipping. */
  blackout(): void {
    if (this.removed) return;
    this.veil.classList.add('is-fast');
    this.veil.classList.remove('is-clear');
    this.lines.forEach((line) => line.classList.remove('is-shown'));
    this.skipHint.classList.remove('is-shown');
  }

  /** Dissolve back from the skip blackout. */
  clearVeilFast(): void {
    if (this.removed) return;
    this.veil.classList.add('is-fast');
    this.veil.classList.add('is-clear');
  }

  /** Fades the whole overlay away and removes it from the document. */
  finish(): void {
    if (this.removed) return;
    this.removed = true;
    this.root.classList.add('is-done');
    window.setTimeout(() => this.root.remove(), 1200);
  }

  dispose(): void {
    if (!this.removed) {
      this.removed = true;
      this.root.remove();
    }
  }
}
