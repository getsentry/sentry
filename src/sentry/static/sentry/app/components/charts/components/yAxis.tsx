import {EChartOption} from 'echarts';

import {Theme} from 'app/utils/theme';

type Props = EChartOption.YAxis & {theme: Theme};

export default function YAxis({theme, ...props}: Props): EChartOption.YAxis {
  return {
    axisLine: {
      show: false,
    },
    axisTick: {
      show: false,
    },
    axisLabel: {
      color: theme.chartLabel,
      fontFamily: theme.text.family,
    },
    splitLine: {
      lineStyle: {
        color: theme.chartLineColor,
        opacity: 0.3,
      },
    },
    ...props,
  };
}
