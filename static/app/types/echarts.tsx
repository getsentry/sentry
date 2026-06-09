import type {AxisPointerComponentOption, LineSeriesOption, PatternObject} from 'echarts';

import type {ECharts} from 'sentry/types/echartsBase';
import type {Confidence} from 'sentry/types/organization';

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

export type DataPoint = Pick<SeriesDataUnit, 'name' | 'value'>;
