import type {DateString} from './core';

export type MetricAggregation =
  | 'sum'
  | 'count_unique'
  | 'avg'
  | 'count'
  | 'min'
  | 'max'
  | 'min'
  | 'p50'
  | 'p75'
  | 'p90'
  | 'p95'
  | 'p99';

export type MetricType =
  | 'c'
  | 'd'
  | 'g'
  | 'e'
  | 's'
  // Virtual metrics combine multiple metrics into one, to hide the internal complexity
  // of span based metrics.
  // Created and used only in the frontend
  | 'v';

export type UseCase = 'custom' | 'transactions' | 'sessions' | 'spans' | 'metric_stats';

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

export type MetricsDataIntervalLadder = 'metrics' | 'bar' | 'dashboard';

export type MetricsApiResponse = {
  end: string;
  groups: MetricsGroup[];
  intervals: string[];
  meta: MetricMeta[];
  query: string;
  start: string;
};

export interface MetricsQueryApiResponse {
  data: {
    by: Record<string, string>;
    series: (number | null)[];
    totals: number;
  }[][];
  end: string;
  intervals: string[];
  meta: [
    ...{name: string; type: string}[],
    // The last entry in meta has a different shape
    MetricsQueryApiResponseLastMeta,
  ][];
  start: string;
}

export interface MetricsQueryApiResponseLastMeta {
  group_bys: string[];
  limit: number | null;
  order: string | null;
  has_more?: boolean;
  scaling_factor?: number | null;
  unit?: string | null;
  unit_family?: 'duration' | 'information' | null;
}

export type MetricsGroup = {
  by: Record<string, string>;
  series: Record<string, (number | null)[]>;
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
  // name: string; // returned by the API but should not be used, use parseMRI(mri).name instead
  operations: MetricAggregation[];
  projectIds: number[];
  type: MetricType;
  unit: string;
};

export type BlockingStatus = {
  blockedTags: string[];
  isBlocked: boolean;
  projectId: number;
};

export type MetricsMetaCollection = Record<string, MetricMeta>;

export interface MetricsExtractionCondition {
  id: number;
  mris: MRI[];
  value: string;
}

export interface MetricsExtractionRule {
  aggregates: MetricAggregation[];
  conditions: MetricsExtractionCondition[];
  createdById: number | null;
  dateAdded: string;
  dateUpdated: string;
  projectId: number;
  spanAttribute: string;
  tags: string[];
  unit: string;
}
