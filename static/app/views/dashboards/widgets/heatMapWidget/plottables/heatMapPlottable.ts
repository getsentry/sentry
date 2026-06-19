import type {SeriesOption} from 'echarts';

import type {PLOTTABLE_TIME_SERIES_VALUE_TYPES} from 'sentry/views/dashboards/widgets/common/settings';
import type {HeatMapValueUnit} from 'sentry/views/dashboards/widgets/common/types';

export type PlottableTimeSeriesValueType =
  (typeof PLOTTABLE_TIME_SERIES_VALUE_TYPES)[number];

/**
 * A `HeatMapPlottable` is any object that can be converted to an ECharts
 * `Series` and therefore plotted on a heat map chart. This could be a data
 * series, markers, or other visual elements. `HeatMapWidgetVisualization` uses
 * `HeatMapPlottable` objects under the hood to convert data coming into
 * the component via props into ECharts series.
 */
export interface HeatMapPlottable {
  /**
   * Largest value on the Z axis
   */
  Zend: number;
  /**
   * Smallest value on the Z axis
   */
  Zstart: number;
  /**
   * Whether this plottable has enough data to be visually represented.
   */
  isEmpty: boolean;
  /**
   * Converts this plottable to ECharts series options.
   * @param plottingOptions Plotting options depend on the specific implementation.
   */
  toSeries(plottingOptions: unknown): SeriesOption[];
  /**
   * Type of Y-axis data (different from Z-axis)
   */
  yAxisValueType: PlottableTimeSeriesValueType;
  /**
   * Unit of the Y-axis data (different from Z-axis)
   */
  yAxisValueUnit: HeatMapValueUnit;
}
