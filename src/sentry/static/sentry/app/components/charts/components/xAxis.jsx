import {getFormattedDate} from 'app/utils/dates';
import theme from 'app/utils/theme';
import {truncationFormatter} from '../utils';

export default function XAxis(
  {isGroupedByDate, shouldRenderTimeOnly, utc, ...props} = {}
) {
  const axisLabelFormatter = value => {
    if (isGroupedByDate) {
      const format = shouldRenderTimeOnly === 'hour' ? 'LT' : 'MMM Do';
      return getFormattedDate(value, format, {local: !utc});
    } else if (props.truncate) {
      return truncationFormatter(value, props.truncate);
    } else {
      return undefined;
    }
  };

  return {
    type: isGroupedByDate ? 'time' : 'category',
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
    splitLine: {
      show: false,
    },
    axisLabel: {
      margin: 12,
      formatter: axisLabelFormatter,
      ...(props.axisLabel || {}),
    },
    axisPointer: {
      show: true,
      type: 'line',
      label: {
        show: false,
      },
      lineStyle: {
        width: 0.5,
      },
    },
    ...props,
  };
}
