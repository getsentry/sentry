import './components/visualMap';

import type {HeatmapSeriesOption, VisualMapComponentOption} from 'echarts';

import type {ReactEchartsRef, Series} from 'sentry/types/echarts';

import HeatMapSeries from './series/heatMapSeries';
import type {BaseChartProps} from './baseChart';
import BaseChart from './baseChart';

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

export default function HeatMapChart({
  ref,
  ...props
}: HeatmapProps & {
  ref?: React.Ref<ReactEchartsRef>;
}) {
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
}
