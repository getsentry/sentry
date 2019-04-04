import * as Sentry from '@sentry/browser';

export function logException(ex, context) {
  Sentry.withScope(scope => {
    if (context) {
      scope.setExtra('context', context);
    }

    Sentry.captureException(ex);
  });
  /*eslint no-console:0*/
  window.console && console.error && console.error(ex);
}
