import * as Sentry from '@sentry/browser';

/**
 * Sets the transaction name
 */
export function setTransactionName(name: string) {
  Sentry.configureScope(scope => {
    scope.setTransaction(name);
    scope.setTag('ui.route', name);
  });
}
