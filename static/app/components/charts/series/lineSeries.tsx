import 'echarts/lib/chart/line';

import type {LineSeriesOption} from 'echarts';

import theme from 'app/utils/theme';

export default function LineSeries(props: LineSeriesOption): LineSeriesOption {
  return {
    showSymbol: false,
    symbolSize: theme.charts.symbolSize,
    ...props,
    type: 'line',
    emphasis: {
      scale: false,
      lineStyle: {
        // disable color highlight on hover
        color: props.color,
        width: undefined,
      },
    },
  };
}
