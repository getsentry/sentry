import * as Sentry from '@sentry/react';

export function logException(ex: Error, context?: any): void {
  Sentry.withScope(scope => {
    if (context) {
      scope.setExtra('context', context);
    }

    Sentry.captureException(ex);
  });

  // eslint-disable-next-line no-console
  if (window.console && console.error) {
    // eslint-disable-next-line no-console
    console.error(ex);
  }
}
