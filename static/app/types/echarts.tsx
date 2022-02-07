import type {AxisPointerComponentOption, ECharts, LineSeriesOption} from 'echarts';
import type ReactEchartsCore from 'echarts-for-react/lib/core';

export type SeriesDataUnit = {
  name: string | number;
  value: number;
  itemStyle?: {
    color?: string;
  };
  // number because we sometimes use timestamps
  onClick?: (series: Series, instance: ECharts) => void;
};

export type Series = {
  data: SeriesDataUnit[];
  seriesName: string;
  areaStyle?: {
    color: string;
    opacity: number;
  };
  color?: string;
  lineStyle?: AxisPointerComponentOption['lineStyle'];
  // https://echarts.apache.org/en/option.html#series-line.z
  markLine?: LineSeriesOption['markLine'];
  stack?: string;
  // https://echarts.apache.org/en/option.html#series-line.stack
  z?: number;
};

export type ReactEchartsRef = ReactEchartsCore & {
  getEchartsInstance: () => ECharts;
};

export type EChartEventHandler<P> = (params: P, instance: ECharts) => void;

export type EChartChartReadyHandler = (instance: ECharts) => void;

export type EChartHighlightHandler = EChartEventHandler<any>;

export type EChartMouseOverHandler = EChartEventHandler<any>;

export type EChartClickHandler = EChartEventHandler<any>;

export type EChartDataZoomHandler = EChartEventHandler<{
  /**
   * percentage of zoom finish position, 0 - 100
   */
  end: number;
  /**
   * percentage of zoom start position, 0 - 100
   */
  start: number;
  type: 'datazoom';
  /**
   * data value of zoom finish position; only exists in zoom event of
   * triggered by toolbar
   */
  endValue?: number;
  /**
   * data value of zoom start position; only exists in zoom event of
   * triggered by toolbar
   */
  startValue?: number;
}>;

export type EChartRestoreHandler = EChartEventHandler<{type: 'restore'}>;

export type EChartFinishedHandler = EChartEventHandler<{}>;

export type EChartRenderedHandler = EChartEventHandler<{}>;
