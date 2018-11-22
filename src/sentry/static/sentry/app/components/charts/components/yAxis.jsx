import theme from 'app/utils/theme';

export default function YAxis(props = {}) {
  return {
    axisLine: {
      show: false,
    },
    axisTick: {
      show: false,
    },
    axisLabel: {
      color: theme.gray1,
    },
    splitLine: {
      lineStyle: {
        color: theme.offWhite,
      },
    },
    ...props,
  };
}
