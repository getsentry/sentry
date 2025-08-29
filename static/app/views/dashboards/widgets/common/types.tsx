import type {Confidence} from 'sentry/types/organization';
import type {DataUnit} from 'sentry/utils/discover/fields';
import type {ThresholdsConfig} from 'sentry/views/dashboards/widgetBuilder/buildSteps/thresholdsStep/thresholds';

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
  /**
   * Difference between the timestamps of the datapoints, in milliseconds
   */
  interval: number;
  valueType: TimeSeriesValueType;
  valueUnit: TimeSeriesValueUnit;
  dataScanned?: 'partial' | 'full';
  isOther?: boolean;
  /**
   * For a top N request, the order is the position of this `TimeSeries` within the respective yAxis.
   */
  order?: number;
};

export type TimeSeriesItem = {
  /**
   * Milliseconds since Unix epoch
   */
  timestamp: number;
  value: number | null;
  confidence?: Confidence;
  /**
   * A data point might be incomplete for a few reasons. One possible reason is that it's too new, and the ingestion of data for this time bucket is still going. Another reason is that it's truncated. For example, if we're plotting a data bucket from 1:00pm to 2:00pm, but the data set only includes data from 1:15pm and on, the bucket is incomplete.
   */
  incomplete?: boolean;
  sampleCount?: number;
  sampleRate?: number;
};

type TimeSeriesGroupBy = {
  key: string;
  /**
   * The `value` of a `groupBy` can sometimes surprisingly be an array, because some datasets support array values. e.g., in the error dataset, the error type could be an array that looks like `["Exception", null, "TypeError"]`
   */
  value: string | Array<string | null> | Array<number | null>;
};

/**
 * Time series data. Unlike other time series abstractions, this is tightly supported by both the backend and the frontend. The `/events-timeseries/` endpoint uses this as the respone data, and `TimeSeriesWidgetVisualization` plottable objects accept this as the backing data.
 */
export type TimeSeries = {
  meta: TimeSeriesMeta;
  values: TimeSeriesItem[];
  yAxis: string;
  groupBy?: TimeSeriesGroupBy[];
};

export type TabularValueType = AttributeValueType;
export type TabularValueUnit = AttributeValueUnit;
export type TabularMeta<TFields extends string = string> = {
  fields: Record<TFields, TabularValueType>;
  units: Record<TFields, TabularValueUnit>;
};

export type TabularRow<TFields extends string = string> = Record<
  TFields,
  number | string | string[] | boolean | null
>;

export type TabularData<TFields extends string = string> = {
  data: Array<TabularRow<TFields>>;
  meta: TabularMeta<TFields>;
};

export type TabularColumn<TFields extends string = string> = {
  key: TFields;
  sortable?: boolean;
  type?: AttributeValueType;
  width?: number;
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
