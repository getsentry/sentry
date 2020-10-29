import {EChartOption} from 'echarts';

import theme from 'app/utils/theme';

export default function LineSeries(
  props: EChartOption.SeriesLine
): EChartOption.SeriesLine {
  return {
    showSymbol: false,
    symbolSize: theme.charts.symbolSize,
    ...props,
    type: 'line',
  };
}
