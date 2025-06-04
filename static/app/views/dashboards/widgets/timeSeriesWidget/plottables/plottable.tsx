import type {SeriesOption} from 'echarts';

import type {ReactEchartsRef} from 'sentry/types/echarts';
import type {PLOTTABLE_TIME_SERIES_VALUE_TYPES} from 'sentry/views/dashboards/widgets/common/settings';
import type {TimeSeriesValueUnit} from 'sentry/views/dashboards/widgets/common/types';

export type PlottableTimeSeriesValueType =
  (typeof PLOTTABLE_TIME_SERIES_VALUE_TYPES)[number];

/**
 * A `Plottable` is any object that can be converted to an ECharts `Series` and therefore plotted on an ECharts chart. This could be a data series, releases, samples, and other kinds of markers. `TimeSeriesWidgetVisualization` uses `Plottable` objects under the hood, to convert data coming into the component via props into ECharts series.
 */
export interface Plottable {
  /**
   * Type of the underlying data
   */
  dataType: PlottableTimeSeriesValueType;
  /**
   * Unit of the underlying data
   */
  dataUnit: TimeSeriesValueUnit;
  /**
   * Start timestamp of the plottable, if applicable
   */
  end: number | null;
  /**
   * Whether this plottable has enough data to be visually represented.
   */
  isEmpty: boolean;
  /**
   * Name of the series. This is used under-the-hood in ECharts.
   */
  name: string;
  /**
   * Whether this plottable needs a color from a shared palette. For example, data series plottables share a palette which is created based on how many series will be plotted.
   */
  needsColor: boolean;
  /**
   * Start timestamp of the plottable, if applicable
   */
  start: number | null;
  /**
   *
   * @param plottingOptions Plotting options depend on the specific implementation of the interface.
   */
  toSeries(plottingOptions: unknown): SeriesOption[];
  /**
   * Optional callback to get access to the chart `ref`. Some Plottables implement this to allow dispatching events to the chart
   */
  handleChartRef?: (ref: ReactEchartsRef) => void;
  /**
   * Optional label for this plottable, if it appears in the legend and in tooltips.
   */
  label?: string;
  /**
   * `TimeSeriesWidgetVisualization` will call this function if the user clicks a point on a series that originated from this plottable.
   */
  onClick?: (dataIndex: number) => void;
  /**
   * `TimeSeriesWidgetVisualization` will call this function if the user moves the highlighting (via mouse, or imperatively) from one point to another point on a series that originated from this plottable.
   */
  onDownplay?: (dataIndex: number) => void;
  /**
   * `TimeSeriesWidgetVisualization` will call this function if the user highlights (via mouse, or imperatively) a point on a series that originated from this plottable.
   */
  onHighlight?: (dataIndex: number) => void;
}
