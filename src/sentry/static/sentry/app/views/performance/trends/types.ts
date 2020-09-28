import moment from 'moment';

import EventView from 'app/utils/discover/eventView';
import {EventsStatsData} from 'app/types';

export type TrendView = EventView & {
  orderby?: string;
  trendFunction?: string;
};

export type TrendFunction = {
  label: string;
  field: TrendFunctionField;
  alias: string;
  chartLabel: string;
  legendLabel: string;
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
  percentage_count_range_2_count_range_1: number;
};

export type TrendsPercentileTransaction = BaseTrendsTransaction & {
  percentile_range_1: number;
  percentile_range_2: number;
  percentage_percentile_range_2_percentile_range_1: number;
  minus_percentile_range_2_percentile_range_1: number;
};

export type TrendsAvgTransaction = BaseTrendsTransaction & {
  avg_range_1: number;
  avg_range_2: number;
  percentage_avg_range_2_avg_range_1: number;
  minus_avg_range_2_avg_range_1: number;
};

export type TrendsUserMiseryTransaction = BaseTrendsTransaction & {
  user_misery_range_1: number;
  user_misery_range_2: number;
  percentage_user_misery_range_2_user_misery_range_1: number;
  minus_user_misery_range_2_user_misery_range_1: number;
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

  received_at: Readonly<moment.MomentInput>;
};

export type NormalizedProjectTrend = Omit<NormalizedTrendsTransaction, 'transaction'>;
