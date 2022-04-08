import 'echarts/lib/chart/line';

import type {LineSeriesOption} from 'echarts';

import theme from 'sentry/utils/theme';

export default function LineSeries(props: LineSeriesOption): LineSeriesOption {
  return {
    showSymbol: false,
    symbolSize: theme.charts.symbolSize,
    ...props,
    type: 'line',
    emphasis: {
      ...props.emphasis,
      scale: false,
      lineStyle: {
        // disable color highlight on hover
        color: props.color as string,
        width: undefined,
      },
      areaStyle: {
        // Disable AreaSeries highlight on hover
        color: props.areaStyle?.color ?? (props.color as string),
        opacity: props.areaStyle?.opacity,
      },
    },
  };
}
