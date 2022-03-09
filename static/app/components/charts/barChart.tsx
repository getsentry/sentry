import * as React from 'react';
import type {BarSeriesOption} from 'echarts';

import {Series} from 'sentry/types/echarts';

import BarSeries from './series/barSeries';
import BaseChart from './baseChart';

type ChartProps = Omit<React.ComponentProps<typeof BaseChart>, 'css'>;

export type BarChartSeries = Series & Omit<BarSeriesOption, 'data' | 'name'>;

type Props = Omit<ChartProps, 'series'> & {
  series: BarChartSeries[];
  animation?: boolean;
  stacked?: boolean;
};

class BarChart extends React.Component<Props> {
  render() {
    const {series, stacked, xAxis, animation, ...props} = this.props;

    return (
      <BaseChart
        {...props}
        xAxis={xAxis !== null ? {...(xAxis || {}), boundaryGap: true} : null}
        series={series.map(({seriesName, data, ...options}) =>
          BarSeries({
            name: seriesName,
            stack: stacked ? 'stack1' : undefined,
            data: data.map(({value, name, itemStyle}) => {
              if (itemStyle === undefined) {
                return [name, value];
              }
              return {value: [name, value], itemStyle};
            }),
            animation,
            ...options,
          })
        )}
      />
    );
  }
}

export default BarChart;
