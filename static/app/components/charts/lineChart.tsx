import type {LineSeriesOption} from 'echarts';

import {Series} from 'sentry/types/echarts';

import LineSeries from './series/lineSeries';
import BaseChart, {BaseChartProps} from './baseChart';

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

export function LineChart({series, seriesOptions, ...props}: LineChartProps) {
  return (
    <BaseChart
      {...props}
      series={series.map(({seriesName, data, dataArray, ...options}) =>
        LineSeries({
          ...seriesOptions,
          ...options,
          name: seriesName,
          data: dataArray || data?.map(({value, name}) => [name, value]),
          animation: false,
          animationThreshold: 1,
          animationDuration: 0,
        })
      )}
    />
  );
}
