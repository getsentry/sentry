import * as Router from 'react-router';
import * as Sentry from '@sentry/browser';

let firstPageLoad = true;
let flushTransactionTimeout = undefined;
let wasInterrupted = false;
let currentTransactionSpan = null;

const TRANSACTION_TIMEOUT = 5000;
const requests = new Set([]);
const renders = new Set([]);
const hasActiveRequests = () => requests.size > 0;
const hasActiveRenders = () => renders.size > 0;

function startTransaction() {
  // We do set the transaction name in the router but we want to start it here
  // since in the App component where we set the transaction name, it's called multiple
  // times. This would result in losing the start of the transaction.
  Sentry.configureScope(scope => {
    if (firstPageLoad) {
      return;
    }

    // If there's a previous transaction span open, finish it
    if (currentTransactionSpan) {
      currentTransactionSpan.finish();
    }

    currentTransactionSpan = Sentry.startSpan({
      op: 'navigation',
      sampled: true,
    });
    scope.setSpan(currentTransactionSpan);
    scope.setTag('ui.nav', 'navigation');
  });

  // Timeout a transaction if no other spans get started
  finishTransaction(TRANSACTION_TIMEOUT);
}

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

export function finishTransaction(delay = TRANSACTION_TIMEOUT) {
  if (flushTransactionTimeout || (hasActiveRenders() || hasActiveRequests())) {
    interruptFlush();
  }

  flushTransactionTimeout = setTimeout(() => {
    Sentry.configureScope(scope => {
      const span = scope.getSpan();
      if (span) {
        span.finish();
        firstPageLoad = false;
      }
    });
  }, delay);
}

/**
 * These `start-` functions attempt to track the state of "actions".
 *
 * They interrupt the transaction flush (which times out), and
 * requires the related `finish-` function to be called.
 */
export function startRequest(id) {
  requests.add(id);
  interruptFlush();
}
export function startRender(id) {
  renders.add(id);
  interruptFlush();
}

/**
 * These `finish-` functions clean up the "active" state of an ongoing "action".
 * If there are no other "actions" and we have interrupted a flush, we should
 * finish the transaction
 */
export function finishRequest(id) {
  requests.delete(id);
  // TODO(apm): Is this necessary? flush should be interrupted already from start()
  interruptFlush();

  if (wasInterrupted && !hasActiveRenders() && !hasActiveRequests()) {
    finishTransaction(1);
  }
}
export function finishRender(id) {
  renders.delete(id);
  interruptFlush();

  if (wasInterrupted && !hasActiveRenders() && !hasActiveRequests()) {
    finishTransaction(1);
  }
}

/**
 * Sets the transaction name
 */
export function setTransactionName(name) {
  Sentry.configureScope(scope => {
    const span = scope.getSpan();

    if (!span) {
      return;
    }

    span.transaction = firstPageLoad ? `PageLoad: ${name}` : name;
    scope.setTag('ui.route', name);
  });
}

/**
 * This is called only when our application is initialized. Creates a root span
 * and creates a router listener to create a new root span as user navigates.
 */
export function startApm() {
  Sentry.configureScope(scope => {
    currentTransactionSpan = Sentry.startSpan({
      op: 'pageload',
      sampled: true,
    });
    scope.setSpan(currentTransactionSpan);
    scope.setTag('ui.nav', 'pageload');
  });
  startTransaction();
  Router.browserHistory.listen(() => startTransaction());
}
