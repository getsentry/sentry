import type {DateString} from 'sentry/types/core';

export type MetricsOperation =
  | 'sum'
  | 'count_unique'
  | 'avg'
  | 'count'
  | 'max'
  | 'p50'
  | 'p75'
  | 'p95'
  | 'p99';

export type MetricType = 'c' | 'd' | 'g' | 'e' | 's';

export type UseCase = 'custom' | 'transactions' | 'sessions' | 'spans';

export type MRI = `${MetricType}:${UseCase}${string}@${string}`;

export type ParsedMRI = {
  name: string;
  type: MetricType;
  unit: string;
  useCase: UseCase;
};

export type MetricsApiRequestMetric = {
  field: string;
  groupBy?: string[];
  orderBy?: string;
  query?: string;
};

export interface MetricsApiRequestQuery extends MetricsApiRequestMetric {
  interval: string;
  end?: DateString;
  environment?: string[];
  includeSeries?: number;
  includeTotals?: number;
  limit?: number;
  project?: number[];
  start?: DateString;
  statsPeriod?: string;
}

export type MetricsDataIntervalLadder = 'ddm' | 'bar' | 'dashboard';

export interface MetricsApiRequestQueryOptions extends Partial<MetricsApiRequestQuery> {
  intervalLadder?: MetricsDataIntervalLadder;
}

export type MetricsApiResponse = {
  end: string;
  groups: MetricsGroup[];
  intervals: string[];
  meta: MetricMeta[];
  query: string;
  start: string;
};

export type MetricsGroup = {
  by: Record<string, string>;
  series: Record<string, Array<number | null>>;
  totals: Record<string, number | null>;
};

export type MetricsTagCollection = Record<string, MetricsTag>;

export type MetricsTag = {
  key: string;
};

export type MetricsTagValue = {
  key: string;
  value: string;
};

export type MetricMeta = {
  blockingStatus: BlockingStatus[];
  mri: MRI;
  // name is returned by the API but should not be used, use parseMRI(mri).name instead
  // name: string;
  operations: MetricsOperation[];
  type: MetricType;
  unit: string;
};

export type BlockingStatus = {
  blockedTags: string[];
  isBlocked: boolean;
  projectId: number;
};

export type MetricsMetaCollection = Record<string, MetricMeta>;
