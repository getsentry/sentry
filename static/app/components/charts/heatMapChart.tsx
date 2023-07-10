import './components/visualMap';

import {forwardRef} from 'react';
import type {HeatmapSeriesOption, VisualMapComponentOption} from 'echarts';

import {ReactEchartsRef, Series} from 'sentry/types/echarts';

import HeatMapSeries from './series/heatMapSeries';
import BaseChart, {BaseChartProps} from './baseChart';

export interface HeatmapSeries
  extends Series,
    Omit<HeatmapSeriesOption, 'data' | 'name' | 'color' | 'id'> {
  dataArray?: HeatmapSeriesOption['data'];
}

interface HeatmapProps extends Omit<BaseChartProps, 'series'> {
  series: HeatmapSeries[];
  visualMaps: VisualMapComponentOption[];
  seriesOptions?: HeatmapSeriesOption;
}

export default forwardRef<ReactEchartsRef, HeatmapProps>((props, ref) => {
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
