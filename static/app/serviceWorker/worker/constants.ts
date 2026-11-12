import * as Sentry from '@sentry/browser';

export const DEBUG_LOGGING = false;

export function log(message: string, options?: Sentry.metrics.MetricOptions) {
  Sentry.metrics.count(`service-worker.worker.${message}`, 1, options);
  if (DEBUG_LOGGING) {
    // eslint-disable-next-line no-console
    console.log(`service-worker.worker.${message}`, options);
  }
}
