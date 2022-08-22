import {Config} from 'sentry/types';

import {initializeLocale} from './initializeLocale';

export async function initializeMain(config: Config) {
  // This needs to be loaded as early as possible, or else the locale library can
  // throw an exception and prevent the application from being loaded.
  //
  // e.g. `app/constants` uses `t()` and is imported quite early
  await initializeLocale(config);

  // This is dynamically imported because we need to make sure locale is configured
  // before proceeding.
  const {initializeApp} = await import('./initializeApp');
  initializeApp(config);
}
