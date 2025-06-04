export enum SpanSortPercentiles {
  P50_EXCLUSIVE_TIME = 'p50ExclusiveTime',
  P75_EXCLUSIVE_TIME = 'p75ExclusiveTime',
  P95_EXCLUSIVE_TIME = 'p95ExclusiveTime',
  P99_EXCLUSIVE_TIME = 'p99ExclusiveTime',
}

export enum SpanSortOthers {
  AVG_OCCURRENCE = 'avgOccurrence',
  SUM_EXCLUSIVE_TIME = 'sumExclusiveTime',
}

export type SpanSort = SpanSortPercentiles | SpanSortOthers;

export type SpanSortOption = {
  field: SpanSort;
  label: string;
  prefix: string;
};

export type SpansTotalValues = {
  'count()': number;
};
