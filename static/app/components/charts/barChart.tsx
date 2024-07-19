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
  barOpacity?: number;
  hideZeros?: boolean;
  stacked?: boolean;
}

export function transformToBarSeries({
  barOpacity = 1,
  series,
  stacked,
  hideZeros = false,
  animation,
}: Pick<BarChartProps, 'barOpacity' | 'hideZeros' | 'series' | 'stacked' | 'animation'>) {
  return series.map(({seriesName, data, ...options}) =>
    BarSeries({
      name: seriesName,
      stack: stacked ? 'stack1' : undefined,
      data: data?.map(({value, name, itemStyle}) => {
        if (itemStyle === undefined) {
          return {
            value: [name, value],
            itemStyle: value === 0 && hideZeros ? {opacity: 0} : {opacity: barOpacity},
            emphasis:
              value === 0 && hideZeros
                ? {itemStyle: {opacity: 0}}
                : {itemStyle: {opacity: 1}},
          };
        }
        return {
          value: [name, value],
          itemStyle:
            value === 0 && hideZeros
              ? {...itemStyle, opacity: 0} // Don't show bars when value = 0 (when hideZeros is enabled)
              : {...itemStyle, opacity: barOpacity},
          emphasis:
            value === 0 && hideZeros
              ? {itemStyle: {opacity: 0}}
              : {itemStyle: {opacity: 1}},
        };
      }),
      animation,
      ...options,
    })
  );
}

const EMPTY_AXIS = {};
export function BarChart({
  barOpacity,
  hideZeros,
  series,
  stacked,
  xAxis,
  animation,
  ...props
}: BarChartProps) {
  const transformedSeries = useMemo(() => {
    return transformToBarSeries({barOpacity, hideZeros, series, stacked, animation});
  }, [animation, barOpacity, hideZeros, series, stacked]);

  const xAxisOptions = useMemo(() => {
    const option = xAxis === null ? null : {...(xAxis || EMPTY_AXIS)};
    return option;
  }, [xAxis]);

  return <BaseChart {...props} xAxis={xAxisOptions} series={transformedSeries} />;
}
