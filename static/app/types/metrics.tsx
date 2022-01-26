export type MetricsApiResponse = {
  intervals: string[];
  groups: {
    by: Record<string, string>;
    totals: Record<string, number | null>;
    series: Record<string, Array<number | null>>;
  }[];
  start: string;
  end: string;
  query: string;
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
};

export type MetricQuery = {
  legend?: string;
  aggregation?: string;
  groupBy?: string[];
  metricMeta?: MetricMeta;
};
