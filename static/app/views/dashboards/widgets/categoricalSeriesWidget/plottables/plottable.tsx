import type {SeriesOption} from 'echarts';

import type {ReactEchartsRef} from 'sentry/types/echarts';
import type {DataUnit} from 'sentry/utils/discover/fields';
import type {CategoricalValueType} from 'sentry/views/dashboards/widgets/common/types';

/**
 * A `CategoricalPlottable` is any object that can be converted to an ECharts
 * `Series` and therefore plotted on a categorical chart. This could be a data
 * series, markers, or other visual elements. `CategoricalSeriesWidgetVisualization` uses
 * `CategoricalPlottable` objects under the hood to convert data coming into
 * the component via props into ECharts series.
 */
export interface CategoricalPlottable {
  /**
   * The category labels for this plottable's data points.
   */
  categories: string[];
  /**
   * Type of the underlying data (e.g., "duration", "number").
   */
  dataType: CategoricalValueType;
  /**
   * Unit of the underlying data (e.g., "millisecond"), or null if unitless.
   */
  dataUnit: DataUnit | null;
  /**
   * Whether this plottable has enough data to be visually represented.
   */
  isEmpty: boolean;
  /**
   * Name of the series. This is used under-the-hood in ECharts.
   */
  name: string;
  /**
   * Whether this plottable needs a color from a shared palette. For example,
   * data series plottables share a palette which is created based on how many
   * series will be plotted.
   */
  needsColor: boolean;
  /**
   * Converts this plottable to ECharts series options.
   * @param plottingOptions Plotting options depend on the specific implementation.
   */
  toSeries(plottingOptions: unknown): SeriesOption[];
  /**
   * Optional callback to get access to the chart `ref`. Some plottables
   * implement this to allow dispatching events to the chart.
   */
  handleChartRef?: (ref: ReactEchartsRef) => void;
  /**
   * Optional label for this plottable, if it appears in the legend and tooltips.
   */
  label?: string;
  /**
   * `CategoricalSeriesWidgetVisualization` will call this function if the user clicks
   * a point on a series that originated from this plottable.
   */
  onClick?: (dataIndex: number) => void;
  /**
   * `CategoricalSeriesWidgetVisualization` will call this function if the user moves
   * the highlighting from one point to another on a series from this plottable.
   */
  onDownplay?: (dataIndex: number) => void;
  /**
   * `CategoricalSeriesWidgetVisualization` will call this function if the user highlights
   * (via mouse, or imperatively) a point on a series from this plottable.
   */
  onHighlight?: (dataIndex: number) => void;
}
