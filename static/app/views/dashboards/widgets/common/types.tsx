import type {Confidence} from 'sentry/types/organization';
import type {ThresholdsConfig} from 'sentry/views/dashboards/widgetBuilder/buildSteps/thresholdsStep/thresholds';
import type {
  CategoricalGroupBy,
  CategoricalItemCategory,
  CategoricalItemValue,
  CategoricalSeriesMeta,
  IncompleteReason,
  TimeSeriesGroupBy,
  TimeSeriesValueType,
  TimeSeriesValueUnit,
} from 'sentry/views/dashboards/widgets/common/typesBase';

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

export type Thresholds = ThresholdsConfig;

/**
 * A single item in a categorical bar chart series.
 */
export interface CategoricalItem {
  /**
   * The category value for this data point.
   */
  category: CategoricalItemCategory;
  /**
   * The numeric value for this category.
   */
  value: CategoricalItemValue;
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
