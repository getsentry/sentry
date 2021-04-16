import 'echarts/lib/chart/pie';

import {EChartOption} from 'echarts';

import {SeriesDataUnit} from 'app/types/echarts';

export default function PieSeries(
  props: Omit<EChartOption.SeriesPie, 'data'> & {
    data?: SeriesDataUnit[] | EChartOption.SeriesPie['data'];
  } = {}
): EChartOption.SeriesPie {
  const {data, ...rest} = props;
  return {
    radius: ['50%', '70%'],
    data: data as EChartOption.SeriesPie['data'],
    ...rest,
    type: 'pie',
  };
}
