/**
 * The quiet instruction bar at the bottom of the screen. Hidden while
 * the pointer is locked (the visitor is walking), shown again on release.
 */
export class MovementHint {
  private readonly root: HTMLElement;

  constructor() {
    const element = document.querySelector<HTMLElement>('#movement-hint');
    if (!element) {
      throw new Error('MovementHint: missing #movement-hint element');
    }
    this.root = element;
    document.addEventListener('pointerlockchange', this.handleLockChange);
  }

  /** Called once the world is ready and walking is possible. */
  show(): void {
    this.root.classList.add('is-visible');
  }

  private readonly handleLockChange = (): void => {
    const locked = document.pointerLockElement !== null;
    this.root.classList.toggle('is-suppressed', locked);
  };

  dispose(): void {
    document.removeEventListener('pointerlockchange', this.handleLockChange);
    this.root.remove();
  }
}
