import moment from 'moment';

import {EventQuery} from 'app/actionCreators/events';
import {EventsStatsData} from 'app/types';
import EventView, {LocationQuery} from 'app/utils/discover/eventView';

export type TrendView = EventView & {
  orderby?: string;
  trendFunction?: string;
  trendType?: TrendChangeType;
  middle?: string;
};

export type TrendsQuery = EventQuery &
  LocationQuery & {
    trendFunction?: string;
    trendType?: TrendChangeType;
    middle?: string;
    interval?: string;
  };

export type TrendFunction = {
  label: string;
  field: TrendFunctionField;
  alias: string;
  legendLabel: string;
};

export type TrendParameter = {
  label: string;
  column: string;
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
  transaction: string;
  project: string;
  count: number;

  aggregate_range_1: number;
  aggregate_range_2: number;
  count_range_1: number;
  count_range_2: number;
  trend_percentage: number;
  trend_difference: number;
  count_percentage: number;
};

export type TrendsDataEvents = {
  data: TrendsTransaction[];
  meta: any;
};

export type TrendsData = {
  events: TrendsDataEvents;
  stats: TrendsStats;
};

export type NormalizedTrendsTransaction = TrendsTransaction & {
  received_at: Readonly<moment.Moment>;
};
