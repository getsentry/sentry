import moment from 'moment';

import theme from 'app/utils/theme';

const TRUNCATION_LENGTH = 80;

export default function XAxis({isGroupedByDate, interval, ...props} = {}) {
  const axisLabelFormatter = isGroupedByDate
    ? (value, index) => {
      const format = interval === 'hour' ? 'LT' : 'MMM Do';
      return moment
        .utc(value)
        .local()
        .format(format);
    }
    : props.truncateXAxis
      ? (value, index) => {
        return value.slice(0, TRUNCATION_LENGTH) + '…';
      }
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
