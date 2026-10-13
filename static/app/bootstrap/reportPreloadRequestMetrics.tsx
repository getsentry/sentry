import * as Sentry from '@sentry/react';

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
      // metrics. Failures without a status (network errors, non-JSON bodies)
      // are captured to find out why. They have no useful stack trace, so
      // group them by error type.
      if (outcome === 'error' && status === undefined && error) {
        Sentry.captureException(error, {
          tags: {preload_request: request},
          fingerprint: ['preload-request', errorName ?? 'unknown'],
        });
      }
    });
  }
}
