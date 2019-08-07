import {ECharts} from 'echarts';

export type SeriesDataUnit = {
  value: number;
  name: string | number; // number because we sometimes use timestamps
};

export type Series = {
  seriesName: string;
  data: SeriesDataUnit[];
};

export type ReactEchartsRef = {
  getEchartsInstance: () => ECharts;
};
