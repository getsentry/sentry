import {getFormattedDate} from 'app/utils/dates';
import theme from 'app/utils/theme';
import {truncationFormatter} from '../utils';

export default function XAxis({isGroupedByDate, interval, utc, ...props} = {}) {
  const axisLabelFormatter = value => {
    if (isGroupedByDate) {
      const format = interval === 'hour' ? 'LT' : 'MMM Do';
      return getFormattedDate(value, format, {local: !utc});
    } else if (props.truncate) {
      return truncationFormatter(value, props.truncate);
    } else {
      return undefined;
    }
  };

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
