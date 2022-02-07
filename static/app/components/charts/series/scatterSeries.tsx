import 'echarts/lib/chart/scatter';

import type {ScatterSeriesOption} from 'echarts';

import theme from 'sentry/utils/theme';

export default function ScatterSeries(props: ScatterSeriesOption): ScatterSeriesOption {
  return {
    // showSymbol: false,
    symbolSize: theme.charts.symbolSize,
    ...props,
    type: 'scatter',
    emphasis: {
      ...props.emphasis,
      scale: true,
      // lineStyle: {
      //   // disable color highlight on hover
      //   color: props.color as string,
      //   width: undefined,
      // },
      // areaStyle: {
      //   // Disable AreaSeries highlight on hover
      //   color: props.areaStyle?.color ?? (props.color as string),
      //   opacity: props.areaStyle?.opacity,
      // },
    },
  };
}
