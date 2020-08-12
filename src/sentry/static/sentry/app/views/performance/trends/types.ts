import EventView from 'app/utils/discover/eventView';
import {EventsStatsData} from 'app/types';

export type TrendView = EventView & {
  orderby?: string;
  trendFunction?: string;
};

export type TrendFunction = {
  label: string;
  field: string;
  alias: string;
};

export enum TrendChangeType {
  IMPROVED = 'improved',
  REGRESSION = 'regression',
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

type BaseTrendsTransaction = {
  transaction: string;
  project?: string; // TODO: Fix allowing project as field

  count_range_1: number;
  count_range_2: number;
  divide_count_range_2_count_range_1: number;
};

export type TrendsPercentileTransaction = BaseTrendsTransaction & {
  percentile_range_1: number;
  percentile_range_2: number;
  divide_percentile_range_2_percentile_range_1: number;
  minus_percentile_range_2_percentile_range_1: number;
};

export type TrendsAvgTransaction = BaseTrendsTransaction & {
  avg_range_1: number;
  avg_range_2: number;
  divide_avg_range_2_avg_range_1: number;
  minus_avg_range_2_avg_range_1: number;
};

export type TrendsUserMiseryTransaction = BaseTrendsTransaction & {
  user_misery_range_1: number;
  user_misery_range_2: number;
  divide_user_misery_range_2_user_misery_range_1: number;
  minus_user_misery_range_2_user_misery_range_1: number;
};

export type TrendsTransaction =
  | TrendsPercentileTransaction
  | TrendsAvgTransaction
  | TrendsUserMiseryTransaction;

export type NormalizedTrendsTransaction = BaseTrendsTransaction & {
  aggregate_range_1: number;
  aggregate_range_2: number;
  divide_aggregate_range_2_aggregate_range_1: number;
  minus_aggregate_range_2_aggregate_range_1: number;
};
