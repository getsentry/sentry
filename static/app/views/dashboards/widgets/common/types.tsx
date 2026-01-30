import type {Confidence} from 'sentry/types/organization';
import type {DataUnit} from 'sentry/utils/discover/fields';
import type {ThresholdsConfig} from 'sentry/views/dashboards/widgetBuilder/buildSteps/thresholdsStep/thresholds';
import type {PLOTTABLE_TIME_SERIES_VALUE_TYPES} from 'sentry/views/dashboards/widgets/common/settings';

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
  | 'currency';

type AttributeValueUnit = DataUnit | null;

type TimeSeriesValueType = AttributeValueType;
export type TimeSeriesValueUnit = AttributeValueUnit;
export type TimeSeriesMeta = {
  /**
   * Difference between the timestamps of the datapoints, in milliseconds.
   */
  interval: number;
  /**
   * The type of the values (e.g., "duration")
   */
  valueType: TimeSeriesValueType;
  /**
   * The unit of the values, if available. The value unit is null if the value type is unitless (e.g., "number"), or the unit could not be determined (this is usually an error case).
   */
  valueUnit: TimeSeriesValueUnit;
  dataScanned?: 'partial' | 'full';
  /**
   * `isOther` is true if this `TimeSeries` is the result of a `groupBy` query, and this is the "other" group.
   */
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
   * Indicates that the data point only contains partial data. The frontend uses this information when plotting timeseries, to indicate to the user that some of the data is not reliable. A reason may be attached.
   */
  incomplete?: boolean;
  incompleteReason?: IncompleteReason;
  /**
   * Indicates the sample count that's associated with the data point. Might be `undefined` if the data set doesn't support extrapolation, or `null` if the extrapolation data was not known.
   */
  sampleCount?: number | null;
  /**
   * Indicates the sampling rate that's associated with the data point. Might be `undefined` if the data set doesn't support extrapolation, or `null` if the extrapolation data was not known.
   */
  sampleRate?: number | null;
};

/**
 * Right now the only kind of incompleteness reason from the backend is ingestion delay, but others are planned or possible (e.g., falling out of retention)
 */
type IncompleteReason = 'INCOMPLETE_BUCKET';

/**
 * Shared base type for grouping information.
 * The `value` can sometimes be an array, because some datasets support array values.
 * e.g., in the error dataset, the error type could be an array that looks like `["Exception", null, "TypeError"]`
 */
type GroupBy = {
  key: string;
  value: string | null | Array<string | null> | Array<number | null>;
};

// Aliases - allows divergence later if unique cases arise
export type TimeSeriesGroupBy = GroupBy;
export type CategoricalGroupBy = GroupBy;

/**
 * Time series data. Unlike other time series abstractions, this is tightly supported by both the backend and the frontend. The `/events-timeseries/` endpoint uses this as the respone data, and `TimeSeriesWidgetVisualization` plottable objects accept this as the backing data.
 */
export type TimeSeries = {
  meta: TimeSeriesMeta;
  values: TimeSeriesItem[];
  yAxis: string;
  /**
   * Represents the grouping information for the time series, if applicable.
   * e.g., if the initial request supplied a `groupBy` query param of `"span.op"`, the
   * `groupBy` of the `TimeSeries` could be `[{key: 'span.op': value: 'db' }]`
   * If the `excludeOther` query param is `true`, an "other" time series will be part of the response. `TimeSeries.meta.isOther` specifies the "other" time series, and `groupBy` is `null` in that case
   */
  groupBy?: TimeSeriesGroupBy[] | null;
};

export type TabularValueType = AttributeValueType | null;
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
  type?: TabularValueType;
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

/**
 * The type of values in a categorical series.
 * This is the same set of types supported by time series, but defined locally
 * to avoid coupling to time series widgets.
 */
export type CategoricalValueType = (typeof PLOTTABLE_TIME_SERIES_VALUE_TYPES)[number];

/**
 * A single item in a categorical bar chart series.
 */
export interface CategoricalItem {
  /**
   * The category value for this data point.
   */
  category: string;
  /**
   * The numeric value for this category.
   */
  value: number | null;
}

/**
 * Metadata for a categorical series.
 */
export interface CategoricalSeriesMeta {
  /**
   * The type of the values (e.g., "duration", "number")
   */
  valueType: CategoricalValueType;
  /**
   * The unit of the values, if applicable.
   */
  valueUnit: DataUnit | null;
}

/**
 * A categorical data series for bar charts. Unlike time series,
 * categorical series have discrete labels on the X axis rather than timestamps.
 */
export interface CategoricalSeries {
  /**
   * Metadata about the series.
   */
  meta: CategoricalSeriesMeta;
  /**
   * The aggregate function this series represents (e.g., "p95(span.duration)").
   */
  valueAxis: string;
  /**
   * The data points in this series.
   */
  values: CategoricalItem[];
  /**
   * Represents the grouping information for the series, if applicable.
   */
  groupBy?: CategoricalGroupBy[] | null;
}
