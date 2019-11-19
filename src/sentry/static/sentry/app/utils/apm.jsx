import * as Sentry from '@sentry/browser';
import {TransactionActivity} from '@sentry/integrations';

/**
 * Sets the transaction name
 */
export function setTransactionName(name) {
  TransactionActivity.updateTransactionName(name);
  Sentry.setTag('ui.route', name);
}
