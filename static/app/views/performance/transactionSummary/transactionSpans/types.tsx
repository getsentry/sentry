import {GridColumnOrder} from 'sentry/components/gridEditable';

export enum SpanSortPercentiles {
  P50_EXCLUSIVE_TIME = 'p50ExclusiveTime',
  P75_EXCLUSIVE_TIME = 'p75ExclusiveTime',
  P95_EXCLUSIVE_TIME = 'p95ExclusiveTime',
  P99_EXCLUSIVE_TIME = 'p99ExclusiveTime',
}

export enum SpanSortOthers {
  COUNT = 'count',
  AVG_OCCURRENCE = 'avgOccurrence',
  SUM_EXCLUSIVE_TIME = 'sumExclusiveTime',
}

export type SpanSort = SpanSortPercentiles | SpanSortOthers;

export type SpanSortOption = {
  prefix: string;
  label: string;
  field: SpanSort;
};

export type SuspectSpanTableColumnKeys =
  | 'id'
  | 'timestamp'
  | 'transactionDuration'
  | 'spanDuration'
  | 'occurrences'
  | 'cumulativeDuration'
  | 'spans';

export type SuspectSpanTableColumn = GridColumnOrder<SuspectSpanTableColumnKeys>;

export type SuspectSpanDataRow = Record<SuspectSpanTableColumnKeys, any>;

export type SpansTotalValues = {
  count: number;
  sum_transaction_duration: number;
};
