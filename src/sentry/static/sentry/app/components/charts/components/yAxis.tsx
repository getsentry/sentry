import {EChartOption} from 'echarts';

import theme from 'app/utils/theme';

export default function YAxis(props: EChartOption.YAxis = {}): EChartOption.YAxis {
  return {
    axisLine: {
      show: false,
    },
    axisTick: {
      show: false,
    },
    axisLabel: {
      color: theme.chartLabel,
    },
    splitLine: {
      lineStyle: {
        color: theme.chartLineColor,
      },
    },
    ...props,
  };
}
