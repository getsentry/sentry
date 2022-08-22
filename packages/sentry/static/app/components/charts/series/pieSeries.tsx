import 'echarts/lib/chart/pie';

import type {PieSeriesOption} from 'echarts';

import type {SeriesDataUnit} from 'sentry/types/echarts';

export default function PieSeries(
  props: Omit<PieSeriesOption, 'data'> & {
    data?: SeriesDataUnit[] | PieSeriesOption['data'];
  } = {}
): PieSeriesOption {
  const {data, ...rest} = props;
  return {
    radius: ['50%', '70%'],
    data: data as PieSeriesOption['data'],
    ...rest,
    type: 'pie',
  };
}
