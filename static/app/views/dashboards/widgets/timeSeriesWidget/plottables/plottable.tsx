import type {SeriesOption} from 'echarts';

import type {
  AggregationOutputType,
  DurationUnit,
  RateUnit,
  SizeUnit,
} from 'sentry/utils/discover/fields';

/**
 * A `Plottable` is any object that can be converted to an ECharts `Series` and therefore plotted on an ECharts chart. This could be a data series, releases, samples, and other kinds of markers. `TimeSeriesWidgetVisualization` uses `Plottable` objects under the hood, to convert data coming into the component via props into ECharts series.
 */
export interface Plottable {
  /**
   * If the plottable is based on data, the type. Otherwise, null
   */
  dataType: AggregationOutputType | null;
  /**
   * If the plottable is based on data, the unit. Otherwise, null
   */
  dataUnit: DurationUnit | SizeUnit | RateUnit | null;
  /**
   * Whether this plottable has enough data to be visually represented.
   */
  isEmpty: boolean;
  /**
   * Whether this plottable needs a color from a shared palette. For example, data series plottables share a palette which is created based on how many series will be plotted.
   */
  needsColor: boolean;
  /**
   *
   * @param plottingOptions Plotting options depend on the specific implementation of the interface.
   */
  toSeries(plottingOptions: unknown): SeriesOption[];
}
