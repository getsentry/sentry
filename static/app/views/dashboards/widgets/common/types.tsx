import type {AccuracyStats, Confidence} from 'sentry/types/organization';
import type {DataUnit} from 'sentry/utils/discover/fields';

import type {ThresholdsConfig} from '../../widgetBuilder/buildSteps/thresholdsStep/thresholdsStep';

type AttributeValueType =
  | 'number'
  | 'integer'
  | 'date'
  | 'boolean'
  | 'duration'
  | 'percentage'
  | 'percent_change'
  | 'string'
  | 'size'
  | 'rate'
  | 'score'
  | null;

type AttributeValueUnit = DataUnit | null;

export type TimeSeriesValueType = AttributeValueType;
export type TimeSeriesValueUnit = AttributeValueUnit;
export type TimeSeriesMeta = {
  type: TimeSeriesValueType;
  unit: TimeSeriesValueUnit;
  isOther?: boolean;
};

export type TimeSeriesItem = {
  timestamp: string;
  value: number | null;
  delayed?: boolean;
};

export type TimeSeries = {
  data: TimeSeriesItem[];
  field: string;
  meta: TimeSeriesMeta;
  confidence?: Confidence;
  sampleCount?: AccuracyStats<number>;
  samplingRate?: AccuracyStats<number | null>;
};

export type TabularValueType = AttributeValueType;
export type TabularValueUnit = AttributeValueUnit;
export type TabularMeta<TFields extends string = string> = {
  fields: Record<TFields, TabularValueType>;
  units: Record<TFields, TabularValueUnit>;
};

export type TabularRow<TFields extends string = string> = Record<
  TFields,
  number | string | null
>;

export type TabularData<TFields extends string = string> = {
  data: Array<TabularRow<TFields>>;
  meta: TabularMeta<TFields>;
};

export type ErrorProp = Error | string;

export interface StateProps {
  error?: ErrorProp;
  isLoading?: boolean;
  onRetry?: () => void;
}

export type Thresholds = ThresholdsConfig;

export type Release = {
  timestamp: string;
  version: string;
};

export type LegendSelection = {[key: string]: boolean};
