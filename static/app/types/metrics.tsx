import {DateString} from './core';
import {SeriesApi} from '.';

export type MetricsApiResponse = SeriesApi & {
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
