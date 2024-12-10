import 'echarts/lib/chart/bar';

import type {BarSeriesOption, LineSeriesOption} from 'echarts';

/**
 * The return type can be BarSeriesOption or LineSeriesOption so that we can add
 * custom lines on top of the event bar chart in `eventGraph.tsx`.
 */
function barSeries(props: BarSeriesOption): BarSeriesOption | LineSeriesOption {
  return {
    ...props,
    type: props.type ?? 'bar',
  };
}

export default barSeries;
