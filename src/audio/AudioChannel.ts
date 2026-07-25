import * as THREE from 'three';

/** Frame-rate-independent exponential approach. */
function damp(current: number, target: number, tau: number, delta: number): number {
  return target + (current - target) * Math.exp(-delta / tau);
}

/**
 * One looping audio source with eased volume. Callers set `target` and
 * `fadeTau`; every fade in the system — start-up, footsteps starting and
 * stopping, ambient blends — is this same exponential approach, so all
 * transitions share one natural character.
 */
export class AudioChannel {
  readonly audio: THREE.Audio;

  /** Volume this channel is easing toward (pre-master). */
  target = 0;
  /** Fade time constant in seconds. */
  fadeTau = 0.8;

  private current = 0;

  constructor(listener: THREE.AudioListener, buffer: AudioBuffer) {
    this.audio = new THREE.Audio(listener);
    this.audio.setBuffer(buffer);
    this.audio.setLoop(true);
    this.audio.setVolume(0);
  }

  /** Begins looped playback (call once the context is running). */
  start(): void {
    if (!this.audio.isPlaying) {
      this.audio.play();
    }
  }

  setPlaybackRate(rate: number): void {
    this.audio.setPlaybackRate(rate);
  }

  update(delta: number, masterGain: number): void {
    this.current = damp(this.current, this.target, this.fadeTau, delta);
    if (this.current < 1e-4 && this.target === 0) this.current = 0;
    this.audio.setVolume(this.current * masterGain);
  }

  dispose(): void {
    if (this.audio.isPlaying) this.audio.stop();
    this.audio.disconnect();
  }
}
