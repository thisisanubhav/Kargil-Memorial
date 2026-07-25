import { Application } from '@/core/Application';

function showFatalError(message: string): void {
  document.querySelector('#loading-screen')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'fatal-error';
  overlay.setAttribute('role', 'alert');
  overlay.textContent = message;
  document.body.appendChild(overlay);
}

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function bootstrap(): void {
  const container = document.querySelector<HTMLElement>('#app');
  if (!container) {
    showFatalError('The experience could not start: application container is missing.');
    return;
  }

  if (!isWebGLAvailable()) {
    showFatalError(
      'This memorial experience needs WebGL, which your browser or device does not currently support.',
    );
    return;
  }

  try {
    const app = new Application(container);
    window.addEventListener('beforeunload', () => app.dispose(), { once: true });
    void app.init();
  } catch (error) {
    console.error('[kargil] failed to start', error);
    showFatalError('Something went wrong while starting the experience. Please refresh the page.');
  }
}

bootstrap();
