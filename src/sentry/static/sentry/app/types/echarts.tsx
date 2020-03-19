import {ECharts} from 'echarts';

export type SeriesDataUnit = {
  value: number;
  name: string | number; // number because we sometimes use timestamps
};

export type Series = {
  seriesName: string;
  data: SeriesDataUnit[];
  color?: string;
  areaStyle?: {
    color: string;
    opacity: number;
  };
};

export type ReactEchartsRef = {
  getEchartsInstance: () => ECharts;
};
