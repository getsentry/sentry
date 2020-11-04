import React from 'react';
import {EChartOption} from 'echarts';

import {Series} from 'app/types/echarts';

import BarSeries from './series/barSeries';
import BaseChart from './baseChart';

type ChartProps = React.ComponentProps<typeof BaseChart>;

export type BarChartSeries = Series & Omit<EChartOption.SeriesBar, 'data' | 'name'>;

type Props = Omit<ChartProps, 'series'> & {
  stacked?: boolean;
  series: BarChartSeries[];
};

export default class BarChart extends React.Component<Props> {
  static propTypes = {
    ...BaseChart.propTypes,
  };

  render() {
    const {series, stacked, xAxis, ...props} = this.props;

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
            ...options,
          })
        )}
      />
    );
  }
}
