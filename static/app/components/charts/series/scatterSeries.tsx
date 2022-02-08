import 'echarts/lib/chart/scatter';

import type {ScatterSeriesOption} from 'echarts';

import theme from 'sentry/utils/theme';

export default function ScatterSeries(props: ScatterSeriesOption): ScatterSeriesOption {
  return {
    symbolSize: theme.charts.symbolSize,
    ...props,
    type: 'scatter',
    emphasis: {
      ...props.emphasis,
      scale: true,
    },
  };
}
