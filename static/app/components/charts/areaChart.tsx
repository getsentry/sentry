import Color from 'color';
import type {LineSeriesOption} from 'echarts';
import {graphic} from 'echarts';

import type {Series} from 'sentry/types/echarts';

import AreaSeries from './series/areaSeries';
import type {BaseChartProps} from './baseChart';
import BaseChart from './baseChart';

export interface AreaChartSeries
  extends Omit<LineSeriesOption, 'data' | 'areaStyle' | 'color' | 'id'>,
    Series {}

export interface AreaChartProps extends Omit<BaseChartProps, 'series'> {
  series: AreaChartSeries[];
  additionalSeries?: LineSeriesOption[];
  stacked?: boolean;
}

export function transformToAreaSeries({
  series,
  stacked,
  colors,
}: Pick<AreaChartProps, 'series' | 'stacked' | 'colors'>) {
  return series.map(({seriesName, data, ...otherSeriesProps}, i) =>
    AreaSeries({
      stack: stacked ? 'area' : undefined,
      name: seriesName,
      data: data.map(({name, value}) => [name, value]),
      lineStyle: {
        color: colors?.[i],
        opacity: 0.8,
        width: 1,
      },
      // areaStyle: {
      //   color: colors?.[i],
      //   opacity: 1.0,
      // },
      areaStyle: {
        color: new graphic.LinearGradient(0, 0, 0, 1, [
          {
            offset: 0,
            color: Color(colors?.[i]).alpha(0.2).rgb().string(),
          },
          {
            offset: 1,
            color: Color(colors?.[i]).alpha(0).rgb().string(),
          },
        ]),
      },
      // Define the z level so that the series remain stacked in the correct order
      // even after operations like hiding / highlighting series
      z: i,
      animation: false,
      animationThreshold: 1,
      animationDuration: 0,
      ...otherSeriesProps,
    })
  );
}

export function AreaChart({series, stacked, colors, ...props}: AreaChartProps) {
  return (
    <BaseChart
      {...props}
      data-test-id="area-chart"
      colors={colors}
      series={transformToAreaSeries({series, stacked, colors})}
    />
  );
}
