import * as THREE from 'three';
import { audioConfig, type AudioConfig } from '@/config/audio';
import type { AudioKey } from '@/config/assets';
import type { AssetManager } from '@/core/AssetManager';
import { AmbientScore } from './AmbientScore';
import { AudioChannel } from './AudioChannel';

export interface VisitorAudioState {
  /** Current horizontal speed in m/s. */
  readonly speed: number;
  /** Smoothed ground height under the visitor. */
  readonly ground: number;
  /** Full walking speed, for normalising. */
  readonly walkSpeed: number;
}

/** Frame-rate-independent exponential approach. */
function damp(current: number, target: number, tau: number, delta: number): number {
  return target + (current - target) * Math.exp(-delta / tau);
}

/**
 * The soundscape: looping wind and snow ambience blended by where the
 * visitor stands, footsteps that exist only while walking, and a quiet
 * procedural score beneath them. Recorded channels are keyed by the typed
 * asset registry; the score is synthesized in the listener's audio context.
 *
 * Browsers keep audio suspended until the page is touched; the system
 * arms itself on the first pointer or key input (the pointer-lock click
 * that starts the walk is the natural moment) and fades in from silence.
 */
export class AudioSystem {
  private readonly listener = new THREE.AudioListener();
  private readonly assets: AssetManager;
  private readonly config: AudioConfig;
  private readonly channels = new Map<AudioKey, AudioChannel>();
  private readonly score: AmbientScore;

  private masterGain = 0;
  private unlocked = false;
  private ready = false;
  private disposed = false;

  constructor(camera: THREE.Camera, assets: AssetManager, config: AudioConfig = audioConfig) {
    this.assets = assets;
    this.config = config;
    camera.add(this.listener);
    this.score = new AmbientScore(this.listener, config.music);

    window.addEventListener('pointerdown', this.handleFirstInput);
    window.addEventListener('keydown', this.handleFirstInput);
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  /** Loads every buffer and builds the channels. Failures degrade to warnings. */
  async start(): Promise<void> {
    const keys: AudioKey[] = ['wind', 'snow', 'footsteps'];
    const results = await Promise.allSettled(keys.map((key) => this.assets.loadAudio(key)));

    if (this.disposed) return;

    results.forEach((result, index) => {
      const key = keys[index]!;
      if (result.status === 'fulfilled') {
        this.channels.set(key, new AudioChannel(this.listener, result.value));
      } else {
        console.warn(`[kargil] audio "${key}" failed to load — continuing without it`, result.reason);
      }
    });

    this.ready = true;
    if (this.unlocked) this.beginPlayback();
  }

  update(delta: number, state: VisitorAudioState): void {
    if (!this.ready) return;

    this.masterGain = damp(this.masterGain, this.unlocked ? 1 : 0, this.config.master.fadeTau, delta);

    const altitude = THREE.MathUtils.clamp(
      (state.ground - this.config.altitude.low) /
        (this.config.altitude.high - this.config.altitude.low),
      0,
      1,
    );

    const wind = this.channels.get('wind');
    if (wind) {
      wind.target = this.config.wind.baseVolume + this.config.wind.altitudeBoost * altitude;
      wind.fadeTau = this.config.wind.fadeTau;
    }

    const snow = this.channels.get('snow');
    if (snow) {
      snow.target = this.config.snow.baseVolume;
      snow.fadeTau = this.config.snow.fadeTau;
    }

    const footsteps = this.channels.get('footsteps');
    if (footsteps) {
      const speedRatio = THREE.MathUtils.clamp(state.speed / state.walkSpeed, 0, 1);
      const walking = state.speed > this.config.footsteps.speedThreshold;
      footsteps.target = walking ? this.config.footsteps.volume * speedRatio : 0;
      footsteps.fadeTau = walking
        ? this.config.footsteps.fadeInTau
        : this.config.footsteps.fadeOutTau;
      footsteps.setPlaybackRate(
        THREE.MathUtils.lerp(this.config.footsteps.minRate, this.config.footsteps.maxRate, speedRatio),
      );
    }

    for (const channel of this.channels.values()) {
      channel.update(delta, this.masterGain);
    }
    this.score.update(delta, this.masterGain);
  }

  private beginPlayback(): void {
    for (const channel of this.channels.values()) {
      channel.start();
    }
    this.score.start();
  }

  private readonly handleFirstInput = (): void => {
    if (this.unlocked || this.disposed) return;
    this.unlocked = true;
    window.removeEventListener('pointerdown', this.handleFirstInput);
    window.removeEventListener('keydown', this.handleFirstInput);

    void this.listener.context.resume().then(() => {
      if (!this.disposed && this.ready) this.beginPlayback();
    });
  };

  private readonly handleVisibility = (): void => {
    if (!this.unlocked || this.disposed) return;
    // rAF (and therefore our fades) stops in hidden tabs, but the audio
    // graph keeps playing — suspend the context instead.
    if (document.visibilityState === 'hidden') {
      void this.listener.context.suspend();
    } else {
      void this.listener.context.resume();
    }
  };

  dispose(): void {
    this.disposed = true;
    window.removeEventListener('pointerdown', this.handleFirstInput);
    window.removeEventListener('keydown', this.handleFirstInput);
    document.removeEventListener('visibilitychange', this.handleVisibility);

    for (const channel of this.channels.values()) {
      channel.dispose();
    }
    this.channels.clear();
    this.score.dispose();
    this.listener.removeFromParent();
  }
}
