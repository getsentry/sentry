import {useMemo} from 'react';
import {BarSeriesOption} from 'echarts';

import type {Series} from 'sentry/types/echarts';

import BarSeries from './series/barSeries';
import BaseChart, {BaseChartProps} from './baseChart';

export interface BarChartSeries
  extends Omit<BarSeriesOption, 'data' | 'color' | 'id'>,
    Series {}

export interface BarChartProps extends BaseChartProps {
  series: BarChartSeries[];
  animation?: boolean;
  stacked?: boolean;
}

const EMPTY_AXIS = {};
export function BarChart({series, stacked, xAxis, animation, ...props}: BarChartProps) {
  const transformedSeries = useMemo(() => {
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
  }, [animation, series, stacked]);

  const xAxisOptions = useMemo(() => {
    const option = xAxis === null ? null : {...(xAxis || EMPTY_AXIS)};
    return option;
  }, [xAxis]);

  return <BaseChart {...props} xAxis={xAxisOptions} series={transformedSeries} />;
}
