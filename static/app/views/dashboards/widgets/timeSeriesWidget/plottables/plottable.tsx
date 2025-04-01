import type {SeriesOption} from 'echarts';

import type {PLOTTABLE_TIME_SERIES_VALUE_TYPES} from '../../common/settings';
import type {TimeSeriesValueUnit} from '../../common/types';

export type PlottableTimeSeriesValueType =
  (typeof PLOTTABLE_TIME_SERIES_VALUE_TYPES)[number];

/**
 * A `Plottable` is any object that can be converted to an ECharts `Series` and therefore plotted on an ECharts chart. This could be a data series, releases, samples, and other kinds of markers. `TimeSeriesWidgetVisualization` uses `Plottable` objects under the hood, to convert data coming into the component via props into ECharts series.
 */
export interface Plottable {
  /**
   * Returns a cloned Plottable, constraining any time-series data within the
   * date boundaries provided
   */
  constrain(boundaryStart: Date | null, boundaryEnd: Date | null): Plottable;
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
  end: string | null;
  /**
   * Whether this plottable has enough data to be visually represented.
   */
  isEmpty: boolean;
  /**
   * Whether this plottable needs a color from a shared palette. For example, data series plottables share a palette which is created based on how many series will be plotted.
   */
  needsColor: boolean;
  /**
   * Start timestamp of the plottable, if applicable
   */
  start: string | null;
  /**
   *
   * @param plottingOptions Plotting options depend on the specific implementation of the interface.
   */
  toSeries(plottingOptions: unknown): SeriesOption[];
  /**
   * Optional label for this plottable, if it appears in the legend and in tooltips.
   */
  label?: string;
  /**
   * `TimeSeriesWidgetVisualization` will call this function if the user highlights (via mouse, or imperatively) a point on a series that originated from this plottable.
   */
  onHighlight?: (dataIndex: number) => void;
}
