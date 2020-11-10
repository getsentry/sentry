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
      color: theme.gray200, // TODO(dark): gray200 --> chartLabel
    },
    splitLine: {
      lineStyle: {
        color: theme.gray100, // TODO(dark): border --> gray100 --> chartLineColor
      },
    },
    ...props,
  };
}
