import {uniqueId} from './guid';

let tracingEnabled = false;
let spanId = null;
let transactionId = null;
let currentRoute = null;

export function start() {
  if (!window.Sentry) return;

  window.Sentry.configureScope((scope) => {
    if (tracingEnabled) return;
    tracingEnabled = true;
    scope.addEventProcessor((event) => ({
      ...event,
      transaction: currentRoute,
      tags: {
        ...(event.tags || {}),
        span_id: spanId,
        transaction_id: transactionId
      }
    }))
  })
}

export function setCurrentRoute(route) {
  currentRoute = route;
}

export function setTransactionId() {
  transactionId = uniqueId();
}

export function setSpanId() {
  spanId = uniqueId();
}

export function getTransactionId() {
  if (!transactionId) setTransactionId();
  return transactionId;
}

export function getSpanId() {
  if (!spanId) setSpanId();
  return spanId;
}
