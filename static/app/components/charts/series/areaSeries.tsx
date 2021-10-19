import type {LineSeriesOption} from 'echarts';

import LineSeries from 'app/components/charts/series/lineSeries';

export default function AreaSeries(props: LineSeriesOption = {}): LineSeriesOption {
  return LineSeries({
    ...props,
  });
}
