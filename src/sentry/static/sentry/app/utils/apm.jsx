import * as Router from 'react-router';
import * as Sentry from '@sentry/browser';
import {TransactionActivity} from '@sentry/integrations';

/**
 * Sets the transaction name
 */
export function setTransactionName(name) {
  TransactionActivity.updateTransactionName(`${name}`);
  Sentry.configureScope(scope => {
    scope.setTag('ui.route', name);
  });
}

/**
 * This is called only when our application is initialized. Creates a transaction
 * and creates a router listener to create a new transaction as user navigates.
 */
export function startApm() {
  TransactionActivity.startIdleTransaction(`${window.location.href}`, {
    op: 'pageload',
    sampled: true,
  });
  Sentry.configureScope(scope => {
    scope.setTag('ui.nav', 'pageload');
  });
  Router.browserHistory.listen(() => {
    TransactionActivity.startIdleTransaction(`${window.location.href}`, {
      op: 'navigation',
      sampled: true,
    });
  });
}
