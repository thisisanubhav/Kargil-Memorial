import type { AppConfig } from './types';
import { productionConfig } from './production';

export const debugConfig: AppConfig = {
  ...productionConfig,
  debug: {
    enabled: true,
    showHelpers: false,
    logging: true,
  },
};
