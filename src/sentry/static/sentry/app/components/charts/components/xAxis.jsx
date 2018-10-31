import moment from 'moment';

import theme from 'app/utils/theme';

export default function XAxis({isGroupedByDate, ...props} = {}) {
  const axisLabelFormatter = isGroupedByDate
    ? (value, index) => moment.utc(value).format('MMM Do')
    : undefined;

  return {
    type: 'category',
    boundaryGap: false,
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
      formatter: axisLabelFormatter,
      ...(props.axisLabel || {}),
    },
    ...props,
  };
}
