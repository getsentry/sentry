import theme from 'app/utils/theme';

export default function XAxis(props = {}) {
  return {
    boundaryGap: true,
    axisLine: {
      lineStyle: {
        color: theme.gray1,
        ...(props.axisLine || {}),
      },
    },
    axisTick: {
      lineStyle: {
        color: theme.gray1,
      },
      ...(props.axisTick || {}),
    },
    axisLabel: {
      margin: 12,
      ...(props.axisLabel || {}),
    },
    ...props,
  };
}
