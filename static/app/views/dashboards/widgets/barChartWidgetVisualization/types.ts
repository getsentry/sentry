import type {DataUnit} from 'sentry/utils/discover/fields';
import type {PlottableTimeSeriesValueType} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';

/**
 * A single item in a categorical bar chart series.
 */
export interface CategoricalItem {
  /**
   * The category label displayed on the X axis.
   */
  label: string;
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
  valueType: PlottableTimeSeriesValueType;
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
   * The data points in this series.
   */
  data: CategoricalItem[];
  /**
   * Metadata about the series.
   */
  meta: CategoricalSeriesMeta;
  /**
   * The field name or aggregate function this series represents.
   */
  yAxis: string;
}
