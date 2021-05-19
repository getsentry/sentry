import './components/visualMap';

import * as React from 'react';
import {EChartOption} from 'echarts';

import {Series} from 'app/types/echarts';

import HeatMapSeries from './series/heatMapSeries';
import BaseChart from './baseChart';

type ChartProps = React.ComponentProps<typeof BaseChart>;

export type LineChartSeries = Series &
  Omit<EChartOption.SeriesHeatmap, 'data' | 'name'> & {
    dataArray?: EChartOption.SeriesHeatmap['data'];
  };

type Props = Omit<ChartProps, 'series'> & {
  series: LineChartSeries[];
  seriesOptions?: EChartOption.SeriesHeatmap;
  visualMaps: EChartOption.VisualMap[];
};

export default class HeatMapChart extends React.Component<Props> {
  render() {
    const {series, seriesOptions, visualMaps, ...props} = this.props;

    return (
      <BaseChart
        options={{
          visualMap: visualMaps,
        }}
        {...props}
        series={series.map(({seriesName, data, dataArray, ...options}) =>
          HeatMapSeries({
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
