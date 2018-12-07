import {uniqueId} from './guid';

let spanId = null;
let transactionId = null;

export function startTransaction() {
  spanId = uniqueId();
  transactionId = uniqueId();
  window.Raven &&
    window.Raven.setTagsContext({span_id: spanId, transaction_id: transactionId});
  return {spanId, transactionId};
}

export function getTransactionId() {
  if (!transactionId) startTransaction();
  return transactionId;
}

export function getSpanId() {
  if (!spanId) startTransaction();
  return spanId;
}
