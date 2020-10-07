import {ECharts, EChartOption} from 'echarts';

export type SeriesDataUnit = {
  value: number;
  name: string | number; // number because we sometimes use timestamps
  onClick?: (series: Series, instance: ECharts) => void;
  itemStyle?: {
    color?: string;
  };
};

export type Series = {
  seriesName: string;
  data: SeriesDataUnit[];
  color?: string;
  areaStyle?: {
    color: string;
    opacity: number;
  };
  lineStyle?: EChartOption.LineStyle;
};

export type ReactEchartsRef = {
  getEchartsInstance: () => ECharts;
};

export type EChartEventHandler<P> = (params: P, instance: ECharts) => void;

export type EChartChartReadyHandler = (instance: ECharts) => void;

export type EChartDataZoomHandler = EChartEventHandler<{
  type: 'datazoom';
  /**
   * percentage of zoom start position, 0 - 100
   */
  start: number;
  /**
   * percentage of zoom finish position, 0 - 100
   */
  end: number;
  /**
   * data value of zoom start position; only exists in zoom event of
   * triggered by toolbar
   */
  startValue?: number;
  /**
   * data value of zoom finish position; only exists in zoom event of
   * triggered by toolbar
   */
  endValue?: number;
}>;
