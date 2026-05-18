import type {Config} from 'sentry/types/system';

import {initializeLocale} from './initializeLocale';

export async function initializeMain(config: Config) {
  const [, {initializeApp}] = await Promise.all([
    initializeLocale(config),
    import('./initializeApp'),
  ]);
  initializeApp(config);
}
