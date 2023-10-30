import {Theme} from '@emotion/react';
import type {XAXisComponentOption} from 'echarts';
import merge from 'lodash/merge';

import type {BaseChartProps} from 'sentry/components/charts/baseChart';
import {truncationFormatter, useShortInterval} from 'sentry/components/charts/utils';
import {getFormattedDate, getTimeFormat} from 'sentry/utils/dates';

type HelperProps =
  | 'isGroupedByDate'
  | 'useShortDate'
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
  theme,

  start,
  end,
  period,
  utc,

  addSecondsToTimeFormat = false,
  ...props
}: XAxisProps): XAXisComponentOption {
  const AxisLabelFormatter = (value: string, index: number) => {
    const timeFormat = getTimeFormat({seconds: addSecondsToTimeFormat});
    const dateFormat = useShortDate ? 'MMM Do' : `MMM D ${timeFormat}`;
    const firstItem = index === 0;
    const format =
      useShortInterval({start, end, period}) && !firstItem ? timeFormat : dateFormat;

    if (isGroupedByDate) {
      return getFormattedDate(value, format, {local: !utc});
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
