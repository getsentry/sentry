import 'echarts/lib/chart/line';

import theme from 'app/utils/theme';

export default function LineSeries(props = {}) {
  return {
    showSymbol: false,
    symbolSize: theme.charts.symbolSize,
    ...props,
    type: 'line',
  };
}
