import {ECharts, EChartOption} from 'echarts';

export type SeriesDataUnit = {
  value: number;
  name: string | number; // number because we sometimes use timestamps
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
