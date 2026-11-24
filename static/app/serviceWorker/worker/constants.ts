import * as Sentry from '@sentry/browser';
import type {MetricOptions} from '@sentry/core';

export const DEBUG_LOGGING = false;

export function log(message: string, options?: MetricOptions) {
  Sentry.metrics.count(`service-worker.worker.${message}`, 1, options);
  if (DEBUG_LOGGING) {
    // eslint-disable-next-line no-console
    console.log(`service-worker.worker.${message}`, options);
  }
}
