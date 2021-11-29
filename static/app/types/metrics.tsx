import {DateString} from './core';

export type MetricsApiResponse = {
  intervals: string[];
  groups: {
    by: Record<string, string>;
    totals: Record<string, number>;
    series: Record<string, number[]>;
  }[];
  start: DateString;
  end: DateString;
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
