import type {DURATION_UNITS, SIZE_UNITS} from 'sentry/utils/discover/fieldRenderers';
import type {FieldValueType} from 'sentry/utils/fields';

export type Unit = keyof typeof DURATION_UNITS | keyof typeof SIZE_UNITS | null;

type BaseReference =
  | Profiling.BaseTransactionProfileReference
  | Profiling.BaseContinuousProfileReference;

type SpecialColumns = {
  'all_examples()': BaseReference[];
};

export type EventsResultsDataRow<F extends string> = Pick<
  SpecialColumns,
  Extract<keyof SpecialColumns, F>
> & {
  [K in Exclude<F, keyof SpecialColumns>]: string[] | string | number | null;
};

export type EventsResultsMeta<F extends string> = {
  fields: Partial<{[K in F]: FieldValueType}>;
  units: Partial<{[K in F]: Unit}>;
};

export type EventsResults<F extends string> = {
  data: Array<EventsResultsDataRow<F>>;
  meta: EventsResultsMeta<F>;
};

export type Sort<F> = {
  key: F;
  order: 'asc' | 'desc';
};

export type TrendType = 'regression' | 'improvement';

export type FunctionTrend = {
  aggregate_range_1: number;
  aggregate_range_2: number;
  breakpoint: number;
  change: TrendType;
  'count()': number;
  examples: FunctionExample[];
  fingerprint: number;
  function: string;
  package: string;
  project: string;
  stats: FunctionTrendStats;
  trend_difference: number;
  trend_percentage: number;
  unweighted_p_value: number;
};

type EpochTime = number;
type DataPoint = {count: number};
type FunctionTrendStatsData = [EpochTime, DataPoint];

type FunctionTrendStats = {
  data: FunctionTrendStatsData[];
  end: number;
  start: number;
};

type FunctionExample = [EpochTime, Profiling.BaseProfileReference];
