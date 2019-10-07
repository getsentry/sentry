import * as Router from 'react-router';
import * as Sentry from '@sentry/browser';

let firstPageLoad = true;

function startTransaction() {
  // We do set the transaction name in the router but we want to start it here
  // since in the App component where we set the transaction name, it's called multiple
  // times. This would result in losing the start of the transaction.
  Sentry.configureScope(scope => {
    if (firstPageLoad) {
      firstPageLoad = false;
    } else {
      const prevTransactionSpan = scope.getSpan();
      // If there is a transaction we set the name to the route
      if (prevTransactionSpan && prevTransactionSpan.timestamp === undefined) {
        prevTransactionSpan.finish();
      }
      scope.setSpan(
        Sentry.startSpan({
          op: 'navigation',
          sampled: true,
        })
      );
    }
  });

  finishTransaction(5000);
}

const requests = new Set([]);
const renders = new Set([]);
let flushTransactionTimeout = undefined;
let interruptFlush = false;

const hasActiveRequests = () => requests.size > 0;
const hasActiveRenders = () => renders.size > 0;

export function finishTransaction(delay) {
  if (flushTransactionTimeout) {
    clearTimeout(flushTransactionTimeout);
  }
  if (
    Array.from(requests).find(([, active]) => active) ||
    Array.from(renders).find(([, active]) => active)
  ) {
    clearTimeout(flushTransactionTimeout);
  }
  flushTransactionTimeout = setTimeout(() => {
    Sentry.configureScope(scope => {
      const span = scope.getSpan();
      if (span) {
        span.finish();
      }
    });
  }, delay || 5000);
}

export function startRequest(id) {
  // if flush is active, stop it
  if (flushTransactionTimeout) {
    clearTimeout(flushTransactionTimeout);
    interruptFlush = true;
  }

  requests.add(id);
}
export function finishRequest(id) {
  requests.delete(id);

  if (interruptFlush && !hasActiveRenders() && !hasActiveRequests()) {
    finishTransaction(1);
  }
}

export function startRender(id) {
  // if flush is active, stop it
  if (flushTransactionTimeout) {
    clearTimeout(flushTransactionTimeout);
    interruptFlush = true;
  }

  renders.add(id);
}

export function finishRender(id) {
  renders.delete(id);

  // if flush is active, stop it
  if (flushTransactionTimeout) {
    clearTimeout(flushTransactionTimeout);
    interruptFlush = true;
  }

  if (interruptFlush && !hasActiveRenders() && !hasActiveRequests()) {
    finishTransaction(1);
  }
}

export function startApm() {
  Sentry.configureScope(scope => {
    scope.setSpan(
      Sentry.startSpan({
        op: 'pageload',
        sampled: true,
      })
    );
  });
  startTransaction();
  Router.browserHistory.listen(() => startTransaction());
}
