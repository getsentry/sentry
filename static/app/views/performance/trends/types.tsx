import moment from 'moment';

import {EventQuery} from 'sentry/actionCreators/events';
import {EventsStatsData, Project} from 'sentry/types';
import EventView, {LocationQuery} from 'sentry/utils/discover/eventView';

export type TrendView = EventView & {
  middle?: string;
  orderby?: string;
  trendFunction?: string;
  trendType?: TrendChangeType;
};

export type TrendsQuery = EventQuery &
  LocationQuery & {
    interval?: string;
    middle?: string;
    trendFunction?: string;
    trendType?: TrendChangeType;
  };

export type TrendFunction = {
  alias: string;
  field: TrendFunctionField;
  label: string;
  legendLabel: string;
};

export type TrendParameter = {
  column: string;
  label: string;
};

export enum TrendChangeType {
  IMPROVED = 'improved',
  REGRESSION = 'regression',
}

export enum TrendFunctionField {
  P50 = 'p50',
  P75 = 'p75',
  P95 = 'p95',
  P99 = 'p99',
  AVG = 'avg',
}

export enum TrendColumnField {
  DURATION = 'transaction.duration',
  LCP = 'measurements.lcp',
  FCP = 'measurements.fcp',
  FID = 'measurements.fid',
  CLS = 'measurements.cls',
  SPANS_DB = 'spans.db',
  SPANS_HTTP = 'spans.http',
  SPANS_BROWSER = 'spans.browser',
  SPANS_RESOURCE = 'spans.resource',
}

export type TrendStat = {
  data: EventsStatsData;
  order: number;
};

export type TrendsStats = {
  [transaction: string]: TrendStat;
};

export type TrendsTransaction = {
  aggregate_range_1: number;
  aggregate_range_2: number;
  count: number;

  count_percentage: number;
  count_range_1: number;
  count_range_2: number;
  project: string;
  transaction: string;
  trend_difference: number;
  trend_percentage: number;
};

export type TrendsDataEvents = {
  data: TrendsTransaction[];
  meta: any;
};

export type TrendsData = {
  events: TrendsDataEvents;
  projects: Project[];
  stats: TrendsStats;
};

export type NormalizedTrendsTransaction = TrendsTransaction & {
  received_at: Readonly<moment.Moment>;
};
