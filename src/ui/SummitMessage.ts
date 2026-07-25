/**
 * The two remembrance lines shown at the summit. Lines live in
 * index.html inside an aria-live region; visibility uses the hidden
 * attribute (so assistive technology announces each line as it appears)
 * plus a class for the CSS fade.
 */
export class SummitMessage {
  private readonly root: HTMLElement;
  private readonly lines: HTMLElement[];
  private readonly timers: number[] = [];

  constructor() {
    const root = document.querySelector<HTMLElement>('#summit-message');
    if (!root) throw new Error('SummitMessage: missing #summit-message element');
    this.root = root;
    this.lines = Array.from(root.querySelectorAll<HTMLElement>('.summit-line'));
  }

  /** Toggles line visibility for the current moment time. */
  applyCues(elapsed: number, cues: readonly { show: number; hide: number }[]): void {
    this.lines.forEach((line, index) => {
      const cue = cues[index];
      if (!cue) return;
      const visible = elapsed >= cue.show && elapsed < cue.hide;
      if (visible && line.hidden) {
        line.hidden = false;
        // Next frame, so the fade transition runs from the hidden state.
        requestAnimationFrame(() => {
          if (!line.hidden) line.classList.add('is-shown');
        });
      } else if (!visible && !line.hidden && elapsed >= cue.hide) {
        this.fadeOut(line);
      }
    });
  }

  /** Fades any visible lines out immediately (early interrupt). */
  clear(): void {
    this.lines.forEach((line) => {
      if (!line.hidden) this.fadeOut(line);
    });
  }

  private fadeOut(line: HTMLElement): void {
    line.classList.remove('is-shown');
    this.timers.push(
      window.setTimeout(() => {
        line.hidden = true;
      }, 1700),
    );
  }

  dispose(): void {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers.length = 0;
    this.root.remove();
  }
}
