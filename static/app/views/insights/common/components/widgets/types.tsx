import type {PageFilters} from 'sentry/types/core';
import type {EChartDataZoomHandler, ReactEchartsRef} from 'sentry/types/echarts';

/**
 * These props are common across components that are required to dynamically
 * render an Insight Chart Widget
 */
export interface LoadableChartWidgetProps {
  /**
   * Reference to the chart instance
   */
  chartRef?: React.Ref<ReactEchartsRef>;

  /**
   * Chart height, needed to ensure that the chart height is consistent with
   * the loading placeholder height
   */
  height?: string | number;

  /**
   * Unique ID for the widget
   *
   * TODO(billy): This should be required when all chart widgets are converted
   */
  id?: string;

  /**
   * The source where this widget was loaded via `<ChartWidgetLoader>` component
   */
  loaderSource?: 'releases-drawer';

  /**
   * Callback that returns an updated ECharts zoom selection. If omitted, the
   * default behavior is to update the URL with updated `start` and `end` query
   * parameters.
   */
  onZoom?: EChartDataZoomHandler;

  /**
   * PageFilters-like object that will override the main PageFilters e.g. in
   * Releases Drawer, we have a smaller timeframe to show a smaller amount of
   * releases.
   */
  pageFilters?: PageFilters;

  /**
   * Show releases as either lines per release or a bubble for a group of releases.
   */
  showReleaseAs?: 'bubble' | 'line' | 'none';
}
