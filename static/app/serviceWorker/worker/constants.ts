import * as Sentry from '@sentry/browser';

export const DEBUG_LOGGING = false;

export function log(message: string, ...args: unknown[]) {
  Sentry.metrics.count(`service-worker.worker.${message}`);
  if (DEBUG_LOGGING) {
    // eslint-disable-next-line no-console
    console.log(`service-worker.worker.${message}`, ...args);
  }
}
