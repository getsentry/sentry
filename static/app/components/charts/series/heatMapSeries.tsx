import 'echarts/lib/chart/heatmap';
import 'echarts/lib/component/visualMap';

import type {HeatmapSeriesOption} from 'echarts';

import {SeriesDataUnit} from 'sentry/types/echarts';

export default function HeatMapSeries(
  props: Omit<HeatmapSeriesOption, 'data'> & {
    data?: SeriesDataUnit[] | HeatmapSeriesOption['data'];
  } = {}
): HeatmapSeriesOption {
  const {data, ...rest} = props;
  return {
    data: data as HeatmapSeriesOption['data'],
    ...rest,
    type: 'heatmap',
  };
}
