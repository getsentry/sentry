import {useMemo} from 'react';
import type {BarSeriesOption} from 'echarts';

import type {Series} from 'sentry/types/echarts';

import BarSeries from './series/barSeries';
import type {BaseChartProps} from './baseChart';
import BaseChart from './baseChart';

export interface BarChartSeries
  extends Omit<BarSeriesOption, 'data' | 'color' | 'id'>,
    Series {}

export interface BarChartProps extends BaseChartProps {
  series: BarChartSeries[];
  animation?: boolean;
  stacked?: boolean;
}

export function transformToBarSeries({
  series,
  stacked,
  animation,
}: Pick<BarChartProps, 'series' | 'stacked' | 'animation'>) {
  return series.map(({seriesName, data, ...options}) =>
    BarSeries({
      name: seriesName,
      stack: stacked ? 'stack1' : undefined,
      data: data?.map(({value, name, itemStyle}) => {
        if (itemStyle === undefined) {
          return [name, value];
        }
        return {value: [name, value], itemStyle};
      }),
      animation,
      ...options,
    })
  );
}

const EMPTY_AXIS = {};
export function BarChart({series, stacked, xAxis, animation, ...props}: BarChartProps) {
  const transformedSeries = useMemo(() => {
    return transformToBarSeries({series, stacked, animation});
  }, [animation, series, stacked]);

  const xAxisOptions = useMemo(() => {
    const option = xAxis === null ? null : {...(xAxis || EMPTY_AXIS)};
    return option;
  }, [xAxis]);

  return <BaseChart {...props} xAxis={xAxisOptions} series={transformedSeries} />;
}
