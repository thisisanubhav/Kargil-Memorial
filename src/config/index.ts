import type { AppConfig } from './types';
import { debugConfig } from './debug';
import { productionConfig } from './production';

function isDebugSession(): boolean {
  if (import.meta.env.DEV) return true;
  return new URLSearchParams(window.location.search).has('debug');
}

export function resolveConfig(): AppConfig {
  return isDebugSession() ? debugConfig : productionConfig;
}

export type { AppConfig } from './types';
