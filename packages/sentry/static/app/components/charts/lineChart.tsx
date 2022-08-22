import type {LineSeriesOption} from 'echarts';

import {Series} from 'sentry/types/echarts';

import LineSeries from './series/lineSeries';
import BaseChart from './baseChart';

type ChartProps = Omit<React.ComponentProps<typeof BaseChart>, 'css'>;

export type LineChartSeries = Series &
  Omit<LineSeriesOption, 'data' | 'name'> & {
    dataArray?: LineSeriesOption['data'];
  };

export interface LineChartProps extends Omit<ChartProps, 'series'> {
  series: LineChartSeries[];
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
