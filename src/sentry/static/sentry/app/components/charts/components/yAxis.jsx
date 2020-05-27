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
      color: theme.gray400,
    },
    splitLine: {
      lineStyle: {
        color: theme.gray100,
      },
    },
    ...props,
  };
}
