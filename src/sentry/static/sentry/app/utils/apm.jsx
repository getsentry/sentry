import * as Router from 'react-router';
import * as Sentry from '@sentry/browser';

let firstPageLoad = true;

function startTransaction() {
  // We do set the transaction name in the router but we want to start it here
  // since in the App component where we set the transaction name, it's called multiple
  // times. This would result in losing the start of the transaction.
  const hub = Sentry.getCurrentHub();
  hub.configureScope(scope => {
    if (firstPageLoad) {
      firstPageLoad = false;
    } else {
      const prevTransactionSpan = scope.getSpan();
      // If there is a transaction we set the name to the route
      if (prevTransactionSpan && prevTransactionSpan.timestamp === undefined) {
        hub.finishSpan(prevTransactionSpan);
      }
      Sentry.startSpan(
        {
          op: 'navigation',
          sampled: true,
        },
        true
      );
    }
  });

  finishTransaction(5000);
}

let flushTransactionTimeout = undefined;
function finishTransaction(delay) {
  if (flushTransactionTimeout) {
    clearTimeout(flushTransactionTimeout);
  }

  flushTransactionTimeout = setTimeout(() => {
    const hub = Sentry.getCurrentHub();
    hub.configureScope(scope => {
      const currentTransaction = scope.getSpan();

      // If there is a transaction, we try to set it's timestamp
      // to the last finished span prior to a timeout
      if (currentTransaction && currentTransaction.finishedSpans) {
        const finished = currentTransaction.finishedSpans;

        if (finished.length > 0) {
          currentTransaction.timestamp = finished[finished.length - 1].timestamp;
          // This is to be inline with SDK behavior, but we should move this to SDK as a whole
          currentTransaction.finishedSpans.push(currentTransaction);
        }
      }

      hub.finishSpan(currentTransaction);
    });
  }, delay || 5000);
}

export function startApm() {
  Sentry.startSpan(
    {
      op: 'pageload',
      sampled: true,
    },
    true
  );
  startTransaction();
  Router.browserHistory.listen(() => startTransaction());
}
