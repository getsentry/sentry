import type {LineSeriesOption} from 'echarts';

import type {Series} from 'sentry/types/echarts';

import LineSeries from './series/lineSeries';
import type {BaseChartProps} from './baseChart';
import BaseChart from './baseChart';

export interface LineChartSeries
  extends Series,
    Omit<LineSeriesOption, 'data' | 'name' | 'color' | 'id' | 'areaStyle'> {
  dataArray?: LineSeriesOption['data'];
}

export interface LineChartProps extends Omit<BaseChartProps, 'series'> {
  series: LineChartSeries[];
  additionalSeries?: LineSeriesOption[];
  seriesOptions?: LineSeriesOption;
}

export function transformToLineSeries({
  series,
  seriesOptions,
}: Pick<LineChartProps, 'series' | 'seriesOptions'>) {
  return series.map(({seriesName, data, dataArray, ...options}) =>
    LineSeries({
      ...seriesOptions,
      ...options,
      name: seriesName,
      data: dataArray || data?.map(({value, name}) => [name, value]),
      animation: false,
      animationThreshold: 1,
      animationDuration: 0,
    })
  );
}

export function LineChart({series, seriesOptions, ...props}: LineChartProps) {
  return <BaseChart {...props} series={transformToLineSeries({series, seriesOptions})} />;
}
