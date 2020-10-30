import {EChartOption} from 'echarts/lib/echarts';

import MarkPoint from './components/markPoint';

export const highlightedSinglePoint: EChartOption.Series = {
  stack: undefined,
  symbolSize: 12,
  markPoint: MarkPoint({
    symbol: 'circle',
    symbolSize: 8,
    silent: true,
    label: {
      show: false,
    },
    data: [
      {
        type: 'max',
      },
    ] as any, // TODO(ts): there's a bug in echart types - 'data' should accept array, it accepts object instead
  }),
};
