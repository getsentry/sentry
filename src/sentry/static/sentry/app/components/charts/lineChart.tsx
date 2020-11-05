import PropTypes from 'prop-types';
import React from 'react';
import {EChartOption} from 'echarts';

import {Series} from 'app/types/echarts';

import BaseChart from './baseChart';
import LineSeries from './series/lineSeries';

type ChartProps = React.ComponentProps<typeof BaseChart>;

export type LineChartSeries = Series &
  Omit<EChartOption.SeriesLine, 'data' | 'name' | 'lineStyle'> & {
    dataArray?: EChartOption.SeriesLine['data'];
    lineStyle?: any; // TODO(ts): Fix when echarts type is updated so that EchartOption.LineStyle matches SeriesLine['lineStyle']
  };

type Props = Omit<ChartProps, 'series'> & {
  series: LineChartSeries[];
  seriesOptions?: EChartOption.SeriesLine;
};

export default class LineChart extends React.Component<Props> {
  static propTypes = {
    ...BaseChart.propTypes,
    seriesOptions: PropTypes.object,
  };

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
          })
        )}
      />
    );
  }
}
