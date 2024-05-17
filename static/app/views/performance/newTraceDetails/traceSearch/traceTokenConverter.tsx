import {
  defaultConfig,
  parseSearch,
  type SearchConfig,
} from 'sentry/components/searchSyntax/parser';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

// Transaction keys
const TRANSACTION_TEXT_KEYS: (keyof TraceTree.Transaction)[] = [
  'event_id',
  'project_slug',
  'parent_event_id',
  'parent_span_id',
  'span_id',
  'transaction',
  'transaction.op',
  'transaction.status',
];
const TRANSACTION_NUMERIC_KEYS: (keyof TraceTree.Transaction)[] = [
  'project_id',
  'start_timestamp',
  'timestamp',
];
const TRANSACTION_DURATION_KEYS: (keyof TraceTree.Transaction)[] = [
  'transaction.duration',
];

// @TODO the current date parsing does not support timestamps, so we
// exclude these keys for now and parse them as numeric keys
const TRANSACTION_DATE_KEYS: (keyof TraceTree.Transaction)[] = [
  //   'start_timestamp',
  //   'timestamp',
];
const TRANSACTION_BOOLEAN_KEYS: (keyof TraceTree.Transaction)[] = [];

// Span keys
const SPAN_TEXT_KEYS: (keyof TraceTree.Span)[] = [
  'hash',
  'description',
  'op',
  'origin',
  'parent_span_id',
  'span_id',
  'trace_id',
  'status',
];
const SPAN_NUMERIC_KEYS: (keyof TraceTree.Span)[] = ['timestamp', 'start_timestamp'];
const SPAN_DURATION_KEYS: (keyof TraceTree.Span)[] = [
  // @TODO create aliases for self_time total_time and duration.
  'exclusive_time',
];
// @TODO the current date parsing does not support timestamps, so we
// exclude these keys for now and parse them as numeric keys
const SPAN_DATE_KEYS: (keyof TraceTree.Span)[] = [
  // 'timestamp', 'start_timestamp'
];
const SPAN_BOOLEAN_KEYS: (keyof TraceTree.Span)[] = ['same_process_as_parent'];

// @TODO Issue keys

const TEXT_KEYS = new Set([...TRANSACTION_TEXT_KEYS, ...SPAN_TEXT_KEYS]);
const NUMERIC_KEYS = new Set([...TRANSACTION_NUMERIC_KEYS, ...SPAN_NUMERIC_KEYS]);
const DURATION_KEYS = new Set([...TRANSACTION_DURATION_KEYS, ...SPAN_DURATION_KEYS]);
const DATE_KEYS = new Set([...TRANSACTION_DATE_KEYS, ...SPAN_DATE_KEYS]);
const BOOLEAN_KEYS = new Set([...TRANSACTION_BOOLEAN_KEYS, ...SPAN_BOOLEAN_KEYS]);

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
