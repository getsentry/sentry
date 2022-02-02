import type {LineSeriesOption} from 'echarts';

import LineSeries from 'sentry/components/charts/series/lineSeries';

export default function AreaSeries(props: LineSeriesOption = {}): LineSeriesOption {
  return LineSeries({
    ...props,
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
  });
}
