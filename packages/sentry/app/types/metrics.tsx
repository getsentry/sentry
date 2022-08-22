export type MetricsType = 'set' | 'counter' | 'distribution' | 'numeric';

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

export type MetricsApiResponse = {
  end: string;
  groups: {
    by: Record<string, string>;
    series?: Record<string, Array<number | null>>;
    totals?: Record<string, number | null>;
  }[];
  intervals: string[];
  query: string;
  start: string;
};

export type MetricsTagCollection = Record<string, MetricsTag>;

export type MetricsTag = {
  key: string;
};

export type MetricsTagValue = {
  key: string;
  value: string;
};

export type MetricsMeta = {
  name: string;
  operations: MetricsOperation[];
  type: MetricsType;
};

export type MetricsMetaCollection = Record<string, MetricsMeta>;
