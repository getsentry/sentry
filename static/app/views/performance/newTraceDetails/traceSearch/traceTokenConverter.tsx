import {
  defaultConfig,
  parseSearch,
  type SearchConfig,
} from 'sentry/components/searchSyntax/parser';

import type {TraceTree} from '../traceModels/traceTree';

// Span keys
type TransactionPrefix = 'Transaction';
// The keys can be prefixed by the entity type they belong to, this ensures that
// conflicting keys on different entities are resolved to the correct entity.
type TransactionKey =
  | `${TransactionPrefix}.${keyof TraceTree.Transaction}`
  | keyof TraceTree.Transaction;
// Transaction keys
const TRANSACTION_TEXT_KEYS: TransactionKey[] = [
  'event_id',
  'project_slug',
  'parent_event_id',
  'parent_span_id',
  'span_id',
  'transaction',
  'transaction.op',
  'transaction.status',
];
const TRANSACTION_NUMERIC_KEYS: TransactionKey[] = [
  'project_id',
  'start_timestamp',
  'timestamp',
];

const TRANSACTION_DURATION_KEYS: TransactionKey[] = ['transaction.duration'];

const TRANSACTION_DURATION_SYNTHETIC_KEYS: TransactionKey[] = [
  // @ts-ignore TS(2322): Type '"duration"' is not assignable to type 'Trans... Remove this comment to see the full error message
  'duration',
  // @ts-ignore TS(2322): Type '"total_time"' is not assignable to type 'Tra... Remove this comment to see the full error message
  'total_time',
];

// @TODO the current date parsing does not support timestamps, so we
// exclude these keys for now and parse them as numeric keys
const TRANSACTION_DATE_KEYS: TransactionKey[] = [
  //   'start_timestamp',
  //   'timestamp',
];
const TRANSACTION_BOOLEAN_KEYS: TransactionKey[] = [];

// Span keys
type SpanPrefix = 'span';
// The keys can be prefixed by the entity type they belong to, this ensures that
// conflicting keys on different entities are resolved to the correct entity.
type SpanKey = `${SpanPrefix}.${keyof TraceTree.Span}` | keyof TraceTree.Span;
const SPAN_TEXT_KEYS: SpanKey[] = [
  'hash',
  'description',
  'op',
  'origin',
  'parent_span_id',
  'span_id',
  'trace_id',
  'status',
];

const SPAN_NUMERIC_KEYS: SpanKey[] = ['timestamp', 'start_timestamp'];
const SPAN_DURATION_KEYS: SpanKey[] = ['exclusive_time'];

// The keys below are not real keys returned by the API, but are instead
// mapped by the frontend to the correct keys for convenience and UX reasons
const SPAN_DURATION_SYNTHETIC_KEYS: SpanKey[] = [
  // @ts-ignore TS(2322): Type '"duration"' is not assignable to type 'SpanK... Remove this comment to see the full error message
  'duration',
  // @ts-ignore TS(2322): Type '"total_time"' is not assignable to type 'Spa... Remove this comment to see the full error message
  'total_time',
  // @ts-ignore TS(2322): Type '"self_time"' is not assignable to type 'Span... Remove this comment to see the full error message
  'self_time',
];

// @TODO the current date parsing does not support timestamps, so we
// exclude these keys for now and parse them as numeric keys
const SPAN_DATE_KEYS: SpanKey[] = [
  // 'timestamp', 'start_timestamp'
];
const SPAN_BOOLEAN_KEYS: SpanKey[] = ['same_process_as_parent'];

function withPrefixedPermutation(
  prefix: 'span' | 'transaction',
  keys: string[]
): string[] {
  return [...keys, ...keys.map(key => `${prefix}.${key}`)];
}

// Keys that do not belong to a particular entity, and can be inferred from the context
const SYNTHETIC_KEYS = new Set(['has']);

// @TODO Add issue keys
const TEXT_KEYS = new Set([
  ...SYNTHETIC_KEYS,
  ...withPrefixedPermutation('transaction', TRANSACTION_TEXT_KEYS),
  ...withPrefixedPermutation('span', SPAN_TEXT_KEYS),
]);
const NUMERIC_KEYS = new Set([
  ...withPrefixedPermutation('transaction', TRANSACTION_NUMERIC_KEYS),
  ...withPrefixedPermutation('span', SPAN_NUMERIC_KEYS),
]);
const DURATION_KEYS = new Set([
  ...withPrefixedPermutation('transaction', TRANSACTION_DURATION_KEYS),
  ...withPrefixedPermutation('transaction', TRANSACTION_DURATION_SYNTHETIC_KEYS),
  ...withPrefixedPermutation('span', SPAN_DURATION_KEYS),
  ...withPrefixedPermutation('span', SPAN_DURATION_SYNTHETIC_KEYS),
]);
const DATE_KEYS = new Set([
  ...withPrefixedPermutation('transaction', TRANSACTION_DATE_KEYS),
  ...withPrefixedPermutation('span', SPAN_DATE_KEYS),
]);
const BOOLEAN_KEYS = new Set([
  ...withPrefixedPermutation('transaction', TRANSACTION_BOOLEAN_KEYS),
  ...withPrefixedPermutation('span', SPAN_BOOLEAN_KEYS),
]);

export const TRACE_SEARCH_CONFIG: SearchConfig = {
  ...defaultConfig,
  textOperatorKeys: TEXT_KEYS,
  durationKeys: DURATION_KEYS,
  percentageKeys: new Set(),
  numericKeys: NUMERIC_KEYS,
  dateKeys: DATE_KEYS,
  booleanKeys: BOOLEAN_KEYS,
};

export function parseTraceSearch(query: string) {
  return parseSearch(query, {...TRACE_SEARCH_CONFIG, parse: true});
}
