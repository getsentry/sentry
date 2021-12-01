import * as React from 'react';
import type {LineSeriesOption} from 'echarts';

import {Series} from 'sentry/types/echarts';

import AreaSeries from './series/areaSeries';
import BaseChart from './baseChart';

type ChartProps = Omit<React.ComponentProps<typeof BaseChart>, 'css'>;

export type AreaChartSeries = Series & Omit<LineSeriesOption, 'data' | 'name'>;

type Props = Omit<ChartProps, 'series'> & {
  series: AreaChartSeries[];
  stacked?: boolean;
};

class AreaChart extends React.Component<Props> {
  render() {
    const {series, stacked, colors, ...props} = this.props;

    return (
      <BaseChart
        {...props}
        colors={colors}
        series={series.map(({seriesName, data, ...otherSeriesProps}, i) =>
          AreaSeries({
            stack: stacked ? 'area' : undefined,
            name: seriesName,
            data: data.map(({name, value}) => [name, value]),
            lineStyle: {
              color: colors?.[i],
              opacity: 1,
              width: 0.4,
            },
            areaStyle: {
              color: colors?.[i],
              opacity: 1.0,
            },
            animation: false,
            animationThreshold: 1,
            animationDuration: 0,
            ...otherSeriesProps,
          })
        )}
      />
    );
  }
}

export default AreaChart;
