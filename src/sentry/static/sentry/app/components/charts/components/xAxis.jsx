import theme from 'app/utils/theme';

export default function XAxis(props = {}) {
  return {
    boundaryGap: true,
    axisLine: {
      lineStyle: {
        color: theme.gray1,
      },
    },
    axisTick: {
      lineStyle: {
        color: theme.gray1,
      },
    },
    axisLabel: {
      margin: 12,
    },
    ...props,
  };
}
