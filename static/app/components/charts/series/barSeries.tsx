import 'echarts/lib/chart/bar';

import type {BarSeriesOption} from 'echarts';

function barSeries(props: BarSeriesOption): BarSeriesOption {
  return {
    ...props,
    type: 'bar',
  };
}

export default barSeries;
