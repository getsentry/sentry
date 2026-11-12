import * as Sentry from '@sentry/react';

import {ConfigStore} from 'sentry/stores/configStore';

export function initializeBundleMetrics() {
  if (
    !window.performance ||
    typeof window.performance.measure !== 'function' ||
    !ConfigStore.get('enableAnalytics')
  ) {
    return;
  }

  try {
    const headMark = performance.getEntriesByName('head-start')[0];
    if (headMark) {
      performance.measure('app.page.bundle-load', 'head-start', 'sentry-app-init');
    }
    performance.getEntriesByType('measure').forEach(measurement => {
      Sentry.metrics.distribution(measurement.name, measurement.duration, {
        unit: 'millisecond',
      });
    });
  } catch (err) {
    Sentry.captureException(err);
  }
}
