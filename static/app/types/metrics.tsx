export type MetricsType = 'set' | 'counter' | 'distribution';

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
    series: Record<string, Array<number | null>>;
    totals: Record<string, number | null>;
  }[];
  intervals: string[];
  query: string;
  start: string;
};

export type MetricTagCollection = Record<string, MetricTag>;

export type MetricTag = {
  key: string;
};

export type MetricTagValue = {
  key: string;
  value: string;
};

export type MetricMeta = {
  name: string;
  operations: MetricsOperation[];
  type: MetricsType;
};

export type MetricsMetaCollection = Record<string, MetricMeta>;

export type MetricQuery = {
  aggregation?: string;
  groupBy?: string[];
  legend?: string;
  metricMeta?: MetricMeta;
};
