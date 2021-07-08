import './components/visualMap';

import * as React from 'react';
import {EChartOption} from 'echarts';

import {ReactEchartsRef, Series} from 'app/types/echarts';

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

export default React.forwardRef<ReactEchartsRef, Props>((props, ref) => {
  const {series, seriesOptions, visualMaps, ...otherProps} = props;
  return (
    <BaseChart
      ref={ref}
      options={{
        visualMap: visualMaps,
      }}
      {...otherProps}
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
});
