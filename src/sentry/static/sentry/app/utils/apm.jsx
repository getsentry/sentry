import * as Sentry from '@sentry/browser';

/**
 * Sets the transaction name
 */
export function setTransactionName(name) {
  Sentry.configureScope(scope => {
    scope.setTransaction(name);
    scope.setTag('ui.route', name);
  });
}
