import type {AxisPointerComponentOption, LineSeriesOption, PatternObject} from 'echarts';

import type {ECharts} from 'sentry/types/echartsBase';
import type {Confidence} from 'sentry/types/organization';
export type {ECharts};
export type {
  EChartBrushEndHandler,
  EChartBrushSelectedHandler,
  EChartBrushStartHandler,
  EChartChartReadyHandler,
  EChartClickHandler,
  EChartDataZoomHandler,
  EChartDownplayHandler,
  EChartEventHandler,
  EChartFinishedHandler,
  EChartHighlightHandler,
  EChartLegendSelectChangeHandler,
  EChartMouseOutHandler,
  EChartMouseOverHandler,
  EChartRenderedHandler,
  EChartRestoreHandler,
  ReactEchartsRef,
} from 'sentry/types/echartsBase';

export type SeriesDataUnit = {
  // number because we sometimes use timestamps
  name: string | number;
  value: number;
  itemStyle?: {
    color?: string;
  };
  onClick?: (series: Series, instance: ECharts) => void;
};

export type Series = {
  data: SeriesDataUnit[];
  seriesName: string;
  areaStyle?: {
    color: string | PatternObject;
    opacity: number;
  };
  color?: string;
  confidence?: Confidence;
  id?: string;
  lineStyle?: AxisPointerComponentOption['lineStyle'];
  // https://echarts.apache.org/en/option.html#series-line.z
  markLine?: LineSeriesOption['markLine'];
  stack?: string;
  // https://echarts.apache.org/en/option.html#series-line.stack
  symbol?: LineSeriesOption['symbol'];
  symbolSize?: LineSeriesOption['symbolSize'];
  z?: number;
};

/**
 * Incomplete type for the "highlight" event handler in ECharts. This is taken
 * from a combination of the ECharts documentation page, and data seen in running code
 * in handlers attached to line charts and pie charts.
 */
/**
 * Incomplete type for the "legendselectchanged" event handler in ECharts. This is extracted from types we were using in the app at one time.
 */
/**
 * XXX: These are incomplete types and can also vary depending on the component type
 *
 * Taken from https://echarts.apache.org/en/api.html#events.Mouse%20events
 */
export type DataPoint = Pick<SeriesDataUnit, 'name' | 'value'>;
