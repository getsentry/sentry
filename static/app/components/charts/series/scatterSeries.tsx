import 'echarts/lib/chart/scatter';

import type {ScatterSeriesOption} from 'echarts';

export default function ScatterSeries(props: ScatterSeriesOption): ScatterSeriesOption {
  return {
    // @TODO(jonasbadalic): this used to be defined on the theme, but
    // not actually used in a number of charts, defeating the purpose of the
    // theme definition and indicating that we need a better abstraction over the
    // series definitions, else it'll always end up being inconsistent
    symbolSize: 6,
    ...props,
    type: 'scatter',
    emphasis: {
      ...props.emphasis,
      scale: true,
    },
  };
}
