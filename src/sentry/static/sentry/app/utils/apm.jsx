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
let wasInterrupted = false;

const hasActiveRequests = () => requests.size > 0;
const hasActiveRenders = () => renders.size > 0;

/**
 * Postpone finishing the root span until all renders and requests are finished
 *
 * TODO(apm): We probably want a hard limit for root span, e.g. it's possible we have long
 * API requests combined with renders that could create a very long root span.
 *
 * TODO(apm): Handle polling requests?
 */
function interruptFlush() {
  if (!flushTransactionTimeout) {
    return;
  }

  clearTimeout(flushTransactionTimeout);
  wasInterrupted = true;
}

export function finishTransaction(delay) {
  if (flushTransactionTimeout || (hasActiveRenders() || hasActiveRequests())) {
    interruptFlush();
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
  requests.add(id);
  interruptFlush();
}

export function finishRequest(id) {
  requests.delete(id);
  interruptFlush();

  if (wasInterrupted && !hasActiveRenders() && !hasActiveRequests()) {
    finishTransaction(1);
  }
}

export function startRender(id) {
  renders.add(id);
  interruptFlush();
}

export function finishRender(id) {
  renders.delete(id);
  interruptFlush();

  if (wasInterrupted && !hasActiveRenders() && !hasActiveRequests()) {
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
