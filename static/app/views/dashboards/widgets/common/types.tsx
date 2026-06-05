import type {Confidence} from 'sentry/types/organization';
import type {ThresholdsConfig} from 'sentry/views/dashboards/widgetBuilder/buildSteps/thresholdsStep/thresholds';

import type {CategoricalGroupBy, CategoricalItemCategory, CategoricalItemValue, CategoricalSeriesMeta, IncompleteReason, TabularRow, TimeSeriesGroupBy, TimeSeriesValueType, TimeSeriesValueUnit} from 'sentry/views/dashboards/widgets/common/typesBase';
export type {CategoricalItemCategory, TabularRow, TimeSeriesGroupBy, TimeSeriesValueUnit};
export type {ErrorPropWithResponseJSON, HeatMapSeries, HeatMapValueUnit, LegendSelection, Release, StateProps, TabularColumn, TabularData, TabularMeta, TabularValueType, TabularValueUnit} from 'sentry/views/dashboards/widgets/common/typesBase';


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
/**
 * Shared base type for grouping information.
 * The `value` can sometimes be an array, because some datasets support array values.
 * e.g., in the error dataset, the error type could be an array that looks like `["Exception", null, "TypeError"]`
 */
// Aliases - allows divergence later if unique cases arise
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
 * The type of values in a categorical series.
 * This is the broadest set of types supported - any value type that can come
 * from the API. The plottable layer constrains this to plottable types.
 */
/**
 * The type of a category in a categorical series.
 * Matches the possible values in a TabularRow, since the source data is from
 * the same endpoint
 */
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
 * Metadata for a categorical series.
 */
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

/**
 * The type of values in a heatmap series.
 * This is the broadest set of types supported - any value type that can come
 * from the API. The plottable layer constrains this to plottable types.
 */
/**
 * A single item in a heat map series.
 */
/**
 * Metadata for a heat map series X-axis. Right now this axis is always time.
 */
/**
 * Metadata for a heat map series Y axis. Right now this is the only axis that is configurable by the user, so it returns the value type and unit.
 */
/**
 * Metadata for a heat map series Z axis. Right now this is always a count.
 */
/**
 * Metadata for a heat map series.
 */
/**
 * A heat map data series for heat map visualizations.
 */
