import * as Router from 'react-router';
import * as Sentry from '@sentry/browser';

let flushTransactionTimeout = undefined;
let firstPageLoad = true;

function startTransaction() {
  // We do set the transaction name in the router but we want to start it here
  // since in the App component where we set the transaction name, it's called multiple
  // times. This would result in losing the start of the transaction.
  let transactionSpan;
  const hub = Sentry.getCurrentHub();
  hub.configureScope(scope => {
    if (firstPageLoad) {
      transactionSpan = scope.getSpan();
      firstPageLoad = false;
    } else {
      const prevTransactionSpan = scope.getSpan();
      // If there is a transaction we set the name to the route
      if (prevTransactionSpan && prevTransactionSpan.timestamp === undefined) {
        hub.finishSpan(prevTransactionSpan);
      }
      transactionSpan = hub.startSpan({
        op: 'navigation',
        sampled: true,
      });
    }
    scope.setSpan(transactionSpan);
  });

  if (flushTransactionTimeout) {
    clearTimeout(flushTransactionTimeout);
  }

  flushTransactionTimeout = setTimeout(() => {
    hub.finishSpan(transactionSpan);
  }, 5000);
}

export function startApm() {
  startTransaction();
  Router.browserHistory.listen(() => {
    startTransaction();
  });
}
