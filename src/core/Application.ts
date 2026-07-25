import * as THREE from 'three';
import { resolveConfig, type AppConfig } from '@/config';
import { atmosphereConfig } from '@/config/atmosphere';
import { AnimationLoop } from './AnimationLoop';
import { PostProcessing } from './PostProcessing';
import { AssetManager } from './AssetManager';
import { CameraManager } from './CameraManager';
import { AppLoadingManager } from './LoadingManager';
import { RendererManager } from './RendererManager';
import { ResizeManager } from './ResizeManager';
import { SceneManager } from './SceneManager';
import { LoadingScreen } from '@/ui/LoadingScreen';
import { MovementHint } from '@/ui/MovementHint';
import { VisitorControls } from '@/controls/VisitorControls';
import { AudioSystem } from '@/audio/AudioSystem';
import { IntroSequence } from '@/cinematic/IntroSequence';
import { SummitMoment } from '@/cinematic/SummitMoment';
import { controlsConfig } from '@/config/controls';
import { summitConfig } from '@/config/summit';
import { loadMemorialData } from '@/data/memorialData';
import { JourneyGuide } from '@/journey/JourneyGuide';
import { InfoPanel } from '@/ui/InfoPanel';
import { IntroOverlay } from '@/ui/IntroOverlay';
import { SummitMessage } from '@/ui/SummitMessage';
import { StoneCard } from '@/world/memorial/StoneCard';
import { World } from '@/world/World';

/**
 * Composition root. Constructs every manager, wires them together through
 * events, and owns the application lifecycle (init → start → dispose).
 */
export class Application {
  readonly config: AppConfig;
  readonly loadingManager: AppLoadingManager;
  readonly assets: AssetManager;
  readonly resize: ResizeManager;
  readonly rendererManager: RendererManager;
  readonly sceneManager: SceneManager;
  readonly cameraManager: CameraManager;
  readonly loop: AnimationLoop;
  readonly pipeline: PostProcessing;

  private readonly loadingScreen: LoadingScreen;
  private readonly movementHint: MovementHint;
  private readonly disposers: Array<() => void> = [];
  private world: World | null = null;
  private controls: VisitorControls | null = null;
  private audio: AudioSystem | null = null;
  private infoPanel: InfoPanel | null = null;
  private stoneCard: StoneCard | null = null;
  private journey: JourneyGuide | null = null;
  private intro: IntroSequence | null = null;
  private loadingProgressUnsubscribe: (() => void) | null = null;
  private summitMoment: SummitMoment | null = null;
  private summitMessage: SummitMessage | null = null;
  private summitSeen = false;
  private disposed = false;

  constructor(container: HTMLElement) {
    this.config = resolveConfig();

    this.loadingScreen = new LoadingScreen();
    this.movementHint = new MovementHint();
    this.loadingManager = new AppLoadingManager();
    this.assets = new AssetManager(this.loadingManager);

    this.resize = new ResizeManager(this.config.renderer.maxPixelRatio);
    this.rendererManager = new RendererManager(container, this.config.renderer, this.resize.size);
    this.sceneManager = new SceneManager(this.config.scene, this.config.debug);
    this.cameraManager = new CameraManager(this.config.camera, this.resize.size);
    this.loop = new AnimationLoop(this.config.loop);
    this.pipeline = new PostProcessing(
      this.rendererManager.renderer,
      this.sceneManager.scene,
      this.cameraManager.camera,
      atmosphereConfig,
      this.resize.size,
    );

    // Progress feeds the loading screen only until it is dismissed —
    // background loads afterwards (audio) must not poke removed DOM.
    this.loadingProgressUnsubscribe = this.loadingManager.on('progress', ({ ratio, itemLabel }) => {
      this.loadingScreen.setProgress(ratio);
      this.loadingScreen.setStatus(`Bringing in ${itemLabel}…`);
    });

    this.disposers.push(
      this.resize.on('resize', (size) => {
        this.rendererManager.setSize(size);
        this.cameraManager.setAspect(size);
        this.pipeline.setSize(size);
      }),
      this.loop.subscribe((delta) => {
        const camera = this.cameraManager.camera;

        if (this.intro) {
          if (this.intro.update(delta)) this.beginVisit();
        } else if (this.summitMoment) {
          // The gaze belongs to the moment; the visitor resumes after.
          if (this.summitMoment.update(delta)) {
            this.summitMoment.dispose();
            this.summitMoment = null;
            this.controls?.syncFromCamera();
          }
        } else {
          this.controls?.update(delta);
          // The journey only speaks to a visitor on the ground.
          if (this.controls) {
            this.journey?.update(camera);
            this.checkSummitArrival();
          }
        }
        this.stoneCard?.update(delta, camera);

        this.world?.update(delta);
        this.audio?.update(delta, {
          speed: this.controls?.currentSpeed ?? 0,
          ground: this.controls?.groundHeight ?? camera.position.y - controlsConfig.eyeHeight,
          walkSpeed: this.controls?.walkSpeed ?? controlsConfig.walkSpeed,
        });
        this.pipeline.render(delta);
      }),
    );

    if (this.config.debug.enabled) {
      Reflect.set(window, '__kargil', this);
      if (this.config.debug.logging) {
        // eslint-disable-next-line no-console
        console.info('[kargil] booted in debug mode', this.config);
      }
    }
  }

  get activeWorld(): World | null {
    return this.world;
  }

  /**
   * Preloads every model, then starts the frame loop and dismisses the
   * loading screen. On failure the overlay switches to its error state
   * and the experience does not start.
   */
  async init(): Promise<void> {
    try {
      const startedAt = performance.now();
      const [, memorialData] = await Promise.all([
        this.assets.preloadModels(),
        loadMemorialData(this.loadingManager),
      ]);

      this.loadingScreen.setStatus('Shaping the valley…');
      this.world = new World(this.assets, this.sceneManager.scene);
      this.world.build(
        this.rendererManager.renderer.capabilities.getMaxAnisotropy(),
        memorialData,
      );
      this.sceneManager.add(this.world.group);

      // Every shadow caster is static (sway and cloth movement are
      // vertex-shader-only and do not touch the depth pass), so the
      // shadow map is rendered once instead of every frame.
      this.rendererManager.renderer.shadowMap.autoUpdate = false;
      this.rendererManager.renderer.shadowMap.needsUpdate = true;

      // Frame the visitor's start pose, capture it as the fly-through's
      // destination, then hand the camera to the intro. Controls are
      // created only when the intro completes.
      this.world.frameCamera(this.cameraManager);
      const camera = this.cameraManager.camera;
      const endPosition = camera.position.clone();
      const endTarget = camera
        .getWorldDirection(new THREE.Vector3())
        .multiplyScalar(25)
        .add(camera.position);
      this.intro = new IntroSequence(camera, endPosition, endTarget, new IntroOverlay());

      // Ambience loads in the background — it must never block first paint.
      this.audio = new AudioSystem(this.cameraManager.camera, this.assets);
      void this.audio.start();

      this.infoPanel = new InfoPanel();
      this.stoneCard = new StoneCard();
      this.sceneManager.add(this.stoneCard.mesh);
      this.journey = new JourneyGuide(this.world.journeyAnchors, this.infoPanel, this.stoneCard);

      if (this.config.debug.logging) {
        const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
        // eslint-disable-next-line no-console
        console.info(`[kargil] world ready in ${seconds}s`);
      }
    } catch (error) {
      console.error('[kargil] failed to prepare the world', error);
      this.loadingScreen.showError(
        'Part of the memorial could not be loaded. Please check your connection and try again.',
      );
      return;
    }

    this.loop.start();
    this.loadingScreen.setStatus('');
    await this.loadingScreen.hide();
    this.loadingProgressUnsubscribe?.();
    this.loadingProgressUnsubscribe = null;
  }

  /**
   * First step onto the platform: honour the arrival once. Position is
   * untouched — only the gaze eases to the flag while the remembrance
   * lines pass and the flame warms. The visit simply continues after.
   */
  private checkSummitArrival(): void {
    if (this.summitSeen || !this.world || !this.controls) return;
    const summit = this.world.summitInfo;
    if (!summit) return;

    const camera = this.cameraManager.camera;
    const distance = Math.hypot(
      camera.position.x - summit.center.x,
      camera.position.z - summit.center.z,
    );
    const onPlatform =
      distance <= summitConfig.triggerRadius &&
      this.controls.groundHeight >= summit.platformTop - summitConfig.triggerHeightTolerance;
    if (!onPlatform) return;

    this.summitSeen = true;
    this.journey?.clear();
    this.summitMessage = new SummitMessage();
    this.summitMoment = new SummitMoment(
      camera,
      summit.flagFocus,
      this.summitMessage,
      (mix) => this.world?.setSummitWarmth(mix),
    );
  }

  /** The intro has landed on the start pose: give control to the visitor. */
  private beginVisit(): void {
    if (!this.world || this.controls) return;
    this.intro = null;

    const world = this.world;
    this.controls = new VisitorControls(
      this.cameraManager.camera,
      this.rendererManager.renderer.domElement,
      {
        groundHeightAt: (x, z) => world.groundHeightAt(x, z),
        obstacles: world.obstacles,
      },
    );
    this.controls.syncFromCamera();
    this.movementHint.show();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.disposers.forEach((unsubscribe) => unsubscribe());
    this.disposers.length = 0;
    this.loadingProgressUnsubscribe?.();
    this.loadingProgressUnsubscribe = null;

    this.loop.dispose();
    this.summitMoment?.dispose();
    this.summitMoment = null;
    this.summitMessage?.dispose();
    this.summitMessage = null;
    this.intro?.dispose();
    this.intro = null;
    this.journey = null;
    this.stoneCard?.dispose();
    this.stoneCard = null;
    this.infoPanel?.dispose();
    this.infoPanel = null;
    this.audio?.dispose();
    this.audio = null;
    this.controls?.dispose();
    this.controls = null;
    this.movementHint.dispose();
    this.pipeline.dispose();
    this.world?.dispose();
    this.world = null;
    this.assets.dispose();
    this.loadingManager.dispose();
    this.sceneManager.dispose();
    this.cameraManager.dispose();
    this.rendererManager.dispose();
    this.resize.dispose();
  }
}
