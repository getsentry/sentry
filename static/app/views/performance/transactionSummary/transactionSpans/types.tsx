import {GridColumnOrder} from 'app/components/gridEditable';

export enum SpanSortPercentiles {
  P50_EXCLUSIVE_TIME = 'p50ExclusiveTime',
  P75_EXCLUSIVE_TIME = 'p75ExclusiveTime',
  P95_EXCLUSIVE_TIME = 'p95ExclusiveTime',
  P99_EXCLUSIVE_TIME = 'p99ExclusiveTime',
}

export enum SpanSortOthers {
  COUNT = 'count',
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
  | 'repeated'
  | 'cumulativeDuration'
  | 'spans';

export type SuspectSpanTableColumn = GridColumnOrder<SuspectSpanTableColumnKeys>;

export type SuspectSpanDataRow = Record<SuspectSpanTableColumnKeys, any>;
