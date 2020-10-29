import * as Sentry from '@sentry/react';

export function logException(ex: Error, context?: any): void {
  Sentry.withScope(scope => {
    if (context) {
      scope.setExtra('context', context);
    }

    Sentry.captureException(ex);
  });
  /*eslint no-console:0*/
  window.console && console.error && console.error(ex);
}
