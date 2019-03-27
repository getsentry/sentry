import {uniqueId} from './guid';

let spanId = null;
let transactionId = null;
let route = null;

export function startTransaction() {
  spanId = uniqueId();
  transactionId = uniqueId();
  if (window.Sentry) {
    window.Sentry.configureScope(function(scope) {
      scope.setTag('span_id', spanId);
      scope.setTag('transaction_id', transactionId);
    });
  }
  return {spanId, transactionId};
}

export function setRoute(currentRoute) {
  route = currentRoute;
  return route;
}

export function getRoute() {
  return route;
}

export function getTransactionId() {
  if (!transactionId) {
    startTransaction();
  }
  return transactionId;
}

export function getSpanId() {
  if (!spanId) {
    startTransaction();
  }
  return spanId;
}
