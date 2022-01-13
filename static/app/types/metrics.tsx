import {DateString} from './core';

export interface MetricsApiResponse {
  intervals: string[];
  groups: {
    by: Record<string, string>;
    totals: Record<string, number | null>;
    series: Record<string, Array<number | null>>;
  }[];
  start: DateString;
  end: DateString;
  query: string;
}

export interface MetricTag {
  key: string;
}

export interface MetricTagValue {
  key: string;
  value: string;
}

export interface MetricMeta {
  name: string;
  operations: string[];
}

export interface MetricQuery {
  legend?: string;
  aggregation?: string;
  groupBy?: string[];
  metricMeta?: MetricMeta;
}
