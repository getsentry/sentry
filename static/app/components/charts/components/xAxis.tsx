import type {Theme} from '@emotion/react';
import type {XAXisComponentOption} from 'echarts';
import merge from 'lodash/merge';

import type {BaseChartProps} from 'sentry/components/charts/baseChart';
import {computeShortInterval, truncationFormatter} from 'sentry/components/charts/utils';
import {getFormattedDate, getTimeFormat} from 'sentry/utils/dates';

type HelperProps =
  | 'isGroupedByDate'
  | 'useShortDate'
  | 'useMultilineDate'
  | 'start'
  | 'end'
  | 'period'
  | 'xAxis'
  | 'utc';

export type XAxisProps = BaseChartProps['xAxis'] &
  Pick<BaseChartProps, HelperProps> & {theme: Theme; addSecondsToTimeFormat?: boolean};

function XAxis({
  isGroupedByDate,
  useShortDate,
  useMultilineDate,
  theme,

  start,
  end,
  period,
  utc,

  addSecondsToTimeFormat = false,
  ...props
}: XAxisProps): XAXisComponentOption {
  const AxisLabelFormatter = (value: string, index: number) => {
    const firstItem = index === 0;
    // Always show the date of the first item. Otherwise check the interval duration
    const showDate = firstItem ? true : !computeShortInterval({start, end, period});

    if (isGroupedByDate) {
      const dateFormat = useShortDate ? 'MMM Do' : `MMM D`;
      const dateString = getFormattedDate(value, dateFormat, {local: !utc});

      const timeFormat = getTimeFormat({seconds: addSecondsToTimeFormat});
      const timeString = getFormattedDate(value, timeFormat, {local: !utc});

      const delimiter = useMultilineDate ? '\n' : ' ';

      return showDate ? `${dateString}${delimiter}${timeString}` : timeString;
    }

    if (props.truncate) {
      return truncationFormatter(value, props.truncate);
    }

    return undefined;
  };

  const defaults: XAXisComponentOption = {
    type: isGroupedByDate ? 'time' : 'category',
    splitNumber: 4,
    axisLine: {
      lineStyle: {
        color: theme.chartLabel,
      },
    },
    axisTick: {
      lineStyle: {
        color: theme.chartLabel,
      },
    },
    splitLine: {
      show: false,
    },
    axisLabel: {
      hideOverlap: true,
      color: theme.chartLabel,
      fontFamily: theme.text.family,
      margin: 12,

      // This was default with ChartZoom, we are making it default for all charts now
      // Otherwise the xAxis can look congested when there is always a min/max label
      showMaxLabel: false,
      showMinLabel: false,

      // @ts-expect-error formatter type is missing
      formatter: AxisLabelFormatter,
    },
    axisPointer: {
      show: true,
      type: 'line',
      label: {
        show: false,
      },
      lineStyle: {
        type: 'solid',
        width: 0.5,
      },
    },
  };

  return merge(defaults, props);
}

export default XAxis;
