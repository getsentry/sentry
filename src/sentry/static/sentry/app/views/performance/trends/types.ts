import moment from 'moment';

import EventView, {LocationQuery} from 'app/utils/discover/eventView';
import {EventsStatsData} from 'app/types';
import {EventQuery} from 'app/actionCreators/events';

export type TrendView = EventView & {
  orderby?: string;
  trendFunction?: string;
  trendType?: string;
};

export type TrendsQuery = EventQuery &
  LocationQuery & {
    trendFunction?: string;
    trendType?: string;
    intervalRatio?: number;
    interval?: string;
  };

export type TrendFunction = {
  label: string;
  field: TrendFunctionField;
  alias: string;
  chartLabel: string;
  legendLabel: string;
};

export type ConfidenceLevel = {
  label: string;
  min?: number;
  max?: number;
};

export enum TrendChangeType {
  IMPROVED = 'improved',
  REGRESSION = 'regression',
}

export enum TrendFunctionField {
  P50 = 'p50()',
  P75 = 'p75()',
  P95 = 'p95()',
  P99 = 'p99()',
  AVG = 'avg(transaction.duration)',
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
