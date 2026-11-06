import type {Theme} from '@emotion/react';
import type {XAXisComponentOption} from 'echarts';
import merge from 'lodash/merge';

import {formatDateTime} from '@sentry/scraps/dateTime';

import type {BaseChartProps} from 'sentry/components/charts/baseChart';
import {formatChartDateTime} from 'sentry/components/charts/formatChartDateTime';
import {computeShortInterval, truncationFormatter} from 'sentry/components/charts/utils';

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

export function createXAxisOptions({
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
  const AxisLabelFormatter = (value: string | number, index: number) => {
    const firstItem = index === 0;
    // Always show the date of the first item. Otherwise check the interval duration
    const showDate = firstItem ? true : !computeShortInterval({start, end, period});

    if (isGroupedByDate) {
      const timezone = utc ? 'UTC' : undefined;
      const dateString = useShortDate
        ? formatChartDateTime(value, 'ordinalDate', {timezone})
        : formatDateTime(value, {
            mode: 'date',
            year: 'never',
            showTimezone: false,
            timezone,
          });
      const timeString = formatDateTime(value, {
        mode: 'time',
        precision: addSecondsToTimeFormat ? 'second' : 'minute',
        showTimezone: false,
        timezone,
      });

      const delimiter = useMultilineDate ? '\n' : ' ';

      return showDate ? `${dateString}${delimiter}${timeString}` : timeString;
    }

    if (props.truncate) {
      return truncationFormatter(value as string, props.truncate);
    }

    return '';
  };

  const defaults: XAXisComponentOption = {
    type: isGroupedByDate ? 'time' : 'category',
    splitNumber: 4,
    axisLine: {
      lineStyle: {
        color: theme.tokens.content.secondary,
      },
    },
    axisTick: {
      lineStyle: {
        color: theme.tokens.content.secondary,
      },
    },
    splitLine: {
      show: false,
    },
    axisLabel: {
      hideOverlap: true,
      color: theme.tokens.content.secondary,
      fontFamily: theme.font.family.sans,
      margin: 12,

      // This was default with ChartZoom, we are making it default for all charts now
      // Otherwise the xAxis can look congested when there is always a min/max label
      showMaxLabel: false,
      showMinLabel: false,

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
