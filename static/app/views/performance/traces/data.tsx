import {type IndexedProperty, SpanIndexedField} from 'sentry/views/starfish/types';

export const fields: IndexedProperty[] = [
  SpanIndexedField.PROJECT,
  SpanIndexedField.ID,
  SpanIndexedField.TRANSACTION_ID,
  SpanIndexedField.TRACE,
  SpanIndexedField.SPAN_OP,
  SpanIndexedField.SPAN_DESCRIPTION,
  SpanIndexedField.TRANSACTION_OP,
  SpanIndexedField.TRANSACTION,
  SpanIndexedField.SPAN_DURATION,
  SpanIndexedField.SPAN_SELF_TIME,
  SpanIndexedField.TIMESTAMP,
];

export type Field = (typeof fields)[number];
