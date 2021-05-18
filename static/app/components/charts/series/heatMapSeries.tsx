import 'echarts/lib/chart/heatmap';
import 'echarts/lib/component/visualMap';

import {EChartOption} from 'echarts';

import {SeriesDataUnit} from 'app/types/echarts';

export default function HeatMapSeries(
  props: Omit<EChartOption.SeriesHeatmap, 'data'> & {
    data?: SeriesDataUnit[] | EChartOption.SeriesHeatmap['data'];
  } = {}
): EChartOption.SeriesHeatmap {
  const {data, ...rest} = props;
  return {
    data: data as EChartOption.SeriesHeatmap['data'],
    ...rest,
    type: 'heatmap',
  };
}
