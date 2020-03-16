import {getFormattedDate} from 'app/utils/dates';
import theme from 'app/utils/theme';

import {truncationFormatter, useShortInterval} from '../utils';

export default function XAxis({
  isGroupedByDate,
  useShortDate,
  axisLabel,
  axisTick,
  axisLine,

  start,
  end,
  period,
  utc,
  ...props
} = {}) {
  const axisLabelFormatter = (value, index) => {
    if (isGroupedByDate) {
      const dateFormat = useShortDate ? 'MMM Do' : 'MMM D LT';
      const firstItem = index === 0;
      const format =
        useShortInterval({start, end, period}) && !firstItem ? 'LT' : dateFormat;
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
        ...(axisLine || {}),
      },
    },
    axisTick: {
      lineStyle: {
        color: theme.gray1,
      },
      ...(axisTick || {}),
    },
    splitLine: {
      show: false,
    },
    axisLabel: {
      margin: 12,

      // This was default with ChartZoom, we are making it default for all charts now
      // Otherwise the xAxis can look congested when there is always a min/max label
      showMaxLabel: false,
      showMinLabel: false,

      formatter: axisLabelFormatter,
      ...(axisLabel || {}),
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
