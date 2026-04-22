import * as Sentry from '@sentry/react';

import {ConfigStore} from 'sentry/stores/configStore';

export function initializeBundleMetrics() {
  if (
    !globalThis.performance ||
    typeof globalThis.performance.measure !== 'function' ||
    !ConfigStore.get('enableAnalytics')
  ) {
    return;
  }

  const release = globalThis.__initialData.sentryConfig?.release;
  try {
    const headMark = performance.getEntriesByName('head-start')[0];
    if (headMark) {
      performance.measure('app.page.bundle-load', 'head-start', 'sentry-app-init');
    }
    performance.getEntriesByType('measure').forEach(measurement => {
      // `window.ra` can potentially be undefined here (e.g. it did not successfully load)
      globalThis.ra?.metric(measurement.name, measurement.duration, {
        release,
      });
    });
  } catch (err) {
    Sentry.captureException(err);
  }
}
