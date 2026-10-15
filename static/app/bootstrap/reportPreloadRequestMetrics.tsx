import * as Sentry from '@sentry/react';

/**
 * Messages of the `TypeError`s browsers throw when a request fails at the
 * network level. Preload requests start before the SDK wraps `fetch`, so it
 * never appends the hostname to them.
 */
const NETWORK_ERROR_MESSAGES = new Set([
  // `fetch` rejections, as matched by the SDK's fetch instrumentation
  'Failed to fetch', // Chromium
  'Load failed', // WebKit
  'NetworkError when attempting to fetch resource.', // Firefox
  // Firefox, reading a body cut short by a dropped connection
  'Content-Length header of network response exceeds response Body.',
]);

function isNetworkError(error: unknown) {
  return error instanceof TypeError && NETWORK_ERROR_MESSAGES.has(error.message);
}

/**
 * Reports the outcome of each request started by the preload-data script.
 * Those requests run before the SDK is initialized, so their outcomes are
 * recorded on `window.__sentry_preload_results` and reported here. Must be
 * called after the SDK is initialized.
 */
export function reportPreloadRequestMetrics() {
  const results = window.__sentry_preload_results;
  if (!results) {
    return;
  }
  delete window.__sentry_preload_results;

  for (const [request, resultPromise] of Object.entries(results)) {
    resultPromise.then(({durationMs, outcome, status, error, errorName}) => {
      Sentry.metrics.distribution('ui.preload-request', durationMs, {
        unit: 'millisecond',
        attributes: {request, outcome, status, errorName},
      });

      // HTTP errors are expected (e.g. expired sessions), so they are only
      // metrics. So are network failures, since the browser hides their
      // cause. Other failures without a status (e.g. non-JSON bodies) are
      // captured to find out why. They have no useful stack trace, so group
      // them by error type.
      if (
        outcome === 'error' &&
        status === undefined &&
        error &&
        !isNetworkError(error)
      ) {
        Sentry.captureException(error, {
          tags: {preload_request: request},
          fingerprint: ['preload-request', errorName ?? 'unknown'],
        });
      }
    });
  }
}
