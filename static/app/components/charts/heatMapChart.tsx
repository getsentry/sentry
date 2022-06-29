import './components/visualMap';

import {forwardRef} from 'react';
import type {HeatmapSeriesOption, VisualMapComponentOption} from 'echarts';

import {ReactEchartsRef, Series} from 'sentry/types/echarts';

import HeatMapSeries from './series/heatMapSeries';
import BaseChart from './baseChart';

type ChartProps = Omit<React.ComponentProps<typeof BaseChart>, 'css'>;

export type HeatmapSeries = Series &
  Omit<HeatmapSeriesOption, 'data' | 'name'> & {
    dataArray?: HeatmapSeriesOption['data'];
  };

type Props = Omit<ChartProps, 'series'> & {
  series: HeatmapSeries[];
  visualMaps: VisualMapComponentOption[];
  seriesOptions?: HeatmapSeriesOption;
};

export default forwardRef<ReactEchartsRef, Props>((props, ref) => {
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
