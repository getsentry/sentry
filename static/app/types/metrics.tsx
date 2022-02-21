export type MetricsColumnType = 'set' | 'counter' | 'duration';

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

export type MetricTag = {
  key: string;
};

export type MetricTagValue = {
  key: string;
  value: string;
};

export type MetricMeta = {
  name: string;
  operations: string[];
  type: MetricsColumnType;
};

export type MetricQuery = {
  aggregation?: string;
  groupBy?: string[];
  legend?: string;
  metricMeta?: MetricMeta;
};
