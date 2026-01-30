import type {DataUnit} from 'sentry/utils/discover/fields';
import type {PLOTTABLE_TIME_SERIES_VALUE_TYPES} from 'sentry/views/dashboards/widgets/common/settings';

/**
 * TODO: Move this to the common types file once this chart is in use. This is a
 * temporary type to avoid issues with knip.
 */

type GroupBy = {
  key: string;
  value: string | null | Array<string | null> | Array<number | null>;
};

export type CategoricalGroupBy = GroupBy;

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
