import React from 'react';
import {EChartOption} from 'echarts';

import {Series} from 'app/types/echarts';

import LineSeries from './series/lineSeries';
import BaseChart from './baseChart';

type ChartProps = React.ComponentProps<typeof BaseChart>;

export type LineChartSeries = Series &
  Omit<EChartOption.SeriesLine, 'data' | 'name'> & {
    dataArray?: EChartOption.SeriesLine['data'];
  };

type Props = Omit<ChartProps, 'series'> & {
  series: LineChartSeries[];
  seriesOptions?: EChartOption.SeriesLine;
};

export default class LineChart extends React.Component<Props> {
  render() {
    const {series, seriesOptions, ...props} = this.props;

    return (
      <BaseChart
        {...props}
        series={series.map(({seriesName, data, dataArray, ...options}) =>
          LineSeries({
            ...seriesOptions,
            ...options,
            name: seriesName,
            data: dataArray || data.map(({value, name}) => [name, value]),
            animation: false,
            animationThreshold: 1,
            animationDuration: 0,
          })
        )}
      />
    );
  }
}
