import type { AppConfig } from './types';

export const productionConfig: AppConfig = {
  renderer: {
    antialias: true,
    maxPixelRatio: 2,
    toneMappingExposure: 1.25,
    shadows: true,
  },
  camera: {
    fov: 50,
    near: 0.5,
    far: 2500,
    initialPosition: [0, 2, 8],
    lookAt: [0, 1.5, 0],
  },
  scene: {
    backgroundColor: 0x05070d,
  },
  loop: {
    maxDelta: 1 / 15,
  },
  debug: {
    enabled: false,
    showHelpers: false,
    logging: false,
  },
};
