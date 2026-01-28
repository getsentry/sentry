import 'echarts/lib/chart/bar';

import type {BarSeriesOption} from 'echarts';

/**
 * Creates a bar series configuration for categorical bar charts.
 * Unlike the time series `barSeries`, this returns only `BarSeriesOption`
 * since categorical charts don't support overlaying line series.
 */
function barCategorical(props: Omit<BarSeriesOption, 'type'>): BarSeriesOption {
  return {
    ...props,
    type: 'bar',
  };
}

export default barCategorical;
