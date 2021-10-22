import type {XAXisComponentOption} from 'echarts';
import merge from 'lodash/merge';

import BaseChart from 'app/components/charts/baseChart';
import {getFormattedDate, getTimeFormat} from 'app/utils/dates';
import {Theme} from 'app/utils/theme';

import {truncationFormatter, useShortInterval} from '../utils';

type ChartProps = React.ComponentProps<typeof BaseChart>;
type HelperProps =
  | 'isGroupedByDate'
  | 'useShortDate'
  | 'start'
  | 'end'
  | 'period'
  | 'utc';

type Props = ChartProps['xAxis'] & Pick<ChartProps, HelperProps> & {theme: Theme};

export default function XAxis({
  isGroupedByDate,
  useShortDate,
  theme,

  start,
  end,
  period,
  utc,
  ...props
}: Props): XAXisComponentOption {
  const axisLabelFormatter = (value: string, index: number) => {
    if (isGroupedByDate) {
      const timeFormat = getTimeFormat();
      const dateFormat = useShortDate ? 'MMM Do' : `MMM D ${timeFormat}`;
      const firstItem = index === 0;
      const format =
        useShortInterval({start, end, period}) && !firstItem ? timeFormat : dateFormat;
      return getFormattedDate(value, format, {local: !utc});
    } else if (props.truncate) {
      return truncationFormatter(value, props.truncate);
    } else {
      return undefined;
    }
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
      formatter: axisLabelFormatter,
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
  };

  return merge(defaults, props);
}
