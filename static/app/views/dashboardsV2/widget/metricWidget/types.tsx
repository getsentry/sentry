import {DisplayType} from '../utils';

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

export type MetricWidget = {
  title: string;
  displayType: DisplayType;
  groupings: MetricQuery[];
  searchQuery?: string;
};
