import * as Sentry from '@sentry/browser';
import {TransactionActivity} from '@sentry/integrations';

/**
 * Sets the transaction name
 */
export function setTransactionName(name) {
  TransactionActivity.updateTransactionName(name);
  Sentry.setTag('ui.route', name);
}

/**
 * This is called only when our application is initialized. Creates a transaction
 * and creates a router listener to create a new transaction as user navigates.
 */
export function startApm() {
  // `${window.location.href}` will be used a temp transaction name
  // Internally once our <App> is mounted and the Router is initalized
  // we call `setTransactionName` to update the full URL to the route name
  TransactionActivity.startIdleTransaction(`${window.location.href}`, {
    op: 'pageload',
    sampled: true,
  });
}
