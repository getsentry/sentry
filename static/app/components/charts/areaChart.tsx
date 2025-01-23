import type {LineSeriesOption} from 'echarts';

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
        color: (colors as any)?.[i],
        opacity: 1,
        width: 0.4,
      },
      areaStyle: {
        color: (colors as any)?.[i],
        opacity: 1.0,
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
