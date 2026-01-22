import type {DataUnit} from 'sentry/utils/discover/fields';
import type {PLOTTABLE_TIME_SERIES_VALUE_TYPES} from 'sentry/views/dashboards/widgets/common/settings';

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
