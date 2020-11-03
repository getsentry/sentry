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
  USER_MISERY = 'user_misery(300)',
}

export type TrendStat = {
  data: EventsStatsData;
  order: number;
};

export type TrendsStats = {
  [transaction: string]: TrendStat;
};

export type TrendsDataEvents = {
  data: TrendsTransaction[];
  meta: any;
};

export type TrendsData = {
  events: TrendsDataEvents;
  stats: TrendsStats;
};

export type ProjectTrendsDataEvents = {
  data: ProjectTrend[];
  meta: any;
};

export type ProjectTrendsData = {
  events: ProjectTrendsDataEvents;
  stats: TrendsStats;
};

type BaseTrendsTransaction = {
  transaction: string;
  project: string;
  count: number;

  count_range_1: number;
  count_range_2: number;
  trend_percentage: number;
  trend_difference: number;
  count_percentage: number;
};

export type TrendsPercentileTransaction = BaseTrendsTransaction & {
  percentile_range_1: number;
  percentile_range_2: number;
};

export type TrendsAvgTransaction = BaseTrendsTransaction & {
  avg_range_1: number;
  avg_range_2: number;
};

export type TrendsUserMiseryTransaction = BaseTrendsTransaction & {
  user_misery_range_1: number;
  user_misery_range_2: number;
};

export type TrendsTransaction =
  | TrendsPercentileTransaction
  | TrendsAvgTransaction
  | TrendsUserMiseryTransaction;

export type ProjectTrend = Omit<TrendsTransaction, 'transaction'>;

export type NormalizedTrendsTransaction = BaseTrendsTransaction & {
  aggregate_range_1: number;
  aggregate_range_2: number;
  percentage_aggregate_range_2_aggregate_range_1: number;
  minus_aggregate_range_2_aggregate_range_1: number;

  received_at: Readonly<moment.Moment>;
};

export type NormalizedProjectTrend = Omit<NormalizedTrendsTransaction, 'transaction'>;
