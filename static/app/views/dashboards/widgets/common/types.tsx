import type {AccuracyStats, Confidence} from 'sentry/types/organization';
import type {DataUnit} from 'sentry/utils/discover/fields';
import type {ThresholdsConfig} from 'sentry/views/dashboards/widgetBuilder/buildSteps/thresholdsStep/thresholdsStep';

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

type TimeSeriesValueType = AttributeValueType;
export type TimeSeriesValueUnit = AttributeValueUnit;
export type TimeSeriesMeta = {
  valueType: TimeSeriesValueType;
  valueUnit: TimeSeriesValueUnit;
  isOther?: boolean;
};

export type TimeSeriesItem = {
  /**
   * Milliseconds since Unix epoch
   */
  timestamp: number;
  value: number | null;
  delayed?: boolean;
};

export type TimeSeries = {
  field: string;
  meta: TimeSeriesMeta;
  values: TimeSeriesItem[];
  confidence?: Confidence;
  dataScanned?: 'full' | 'partial';
  sampleCount?: AccuracyStats<number>;
  samplingRate?: AccuracyStats<number | null>;
};

export type TabularValueType = AttributeValueType;
export type TabularValueUnit = AttributeValueUnit;
type TabularMeta<TFields extends string = string> = {
  fields: Record<TFields, TabularValueType>;
  units: Record<TFields, TabularValueUnit>;
};

export type TabularRow<TFields extends string = string> = Record<
  TFields,
  number | string | string[] | null
>;

export type TabularData<TFields extends string = string> = {
  data: Array<TabularRow<TFields>>;
  meta: TabularMeta<TFields>;
};

type ErrorProp = Error | string;
export interface ErrorPropWithResponseJSON extends Error {
  responseJSON?: {detail: string};
}

export interface StateProps {
  error?: ErrorProp | ErrorPropWithResponseJSON;
  isLoading?: boolean;
  onRetry?: () => void;
}

export type Thresholds = ThresholdsConfig;

export type Release = {
  timestamp: string;
  version: string;
};

export type LegendSelection = Record<string, boolean>;
