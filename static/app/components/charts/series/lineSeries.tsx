import 'echarts/lib/chart/line';

import {EChartOption} from 'echarts';

import theme from 'sentry/utils/theme';

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
