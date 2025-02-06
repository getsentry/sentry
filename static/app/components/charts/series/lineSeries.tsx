import 'echarts/lib/chart/line';

import type {LineSeriesOption} from 'echarts';

export default function LineSeries(props: LineSeriesOption): LineSeriesOption {
  return {
    showSymbol: false,
    // @TODO(jonasbadalic): this used to be defined on the theme, but
    // not actually used in a number of charts, defeating the purpose of the
    // theme definition and indicating that we need a better abstraction over the
    // series definitions, else it'll always end up being inconsistent
    symbolSize: 6,
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
