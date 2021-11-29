import {EChartOption} from 'echarts';
import merge from 'lodash/merge';

import BaseChart from 'sentry/components/charts/baseChart';
import {truncationFormatter, useShortInterval} from 'sentry/components/charts/utils';
import {getFormattedDate, getTimeFormat} from 'sentry/utils/dates';
import {Theme} from 'sentry/utils/theme';

type ChartProps = React.ComponentProps<typeof BaseChart>;
type HelperProps =
  | 'isGroupedByDate'
  | 'useShortDate'
  | 'start'
  | 'end'
  | 'period'
  | 'utc';

type Props = ChartProps['xAxis'] &
  Pick<ChartProps, HelperProps> & {theme: Theme; addSecondsToTimeFormat?: boolean};

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
}: Props): EChartOption.XAxis {
  const axisLabelFormatter = (value: string, index: number) => {
    if (isGroupedByDate) {
      const timeFormat = getTimeFormat({displaySeconds: addSecondsToTimeFormat});
      const dateFormat = useShortDate ? 'MMM Do' : `MMM D ${timeFormat}`;
      const firstItem = index === 0;
      const format =
        useShortInterval({start, end, period}) && !firstItem ? timeFormat : dateFormat;
      return getFormattedDate(value, format, {local: !utc});
    }

    if (props.truncate) {
      return truncationFormatter(value, props.truncate);
    }

    return undefined;
  };

  return merge(
    {
      type: isGroupedByDate ? 'time' : 'category',
      boundaryGap: false,
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
        color: theme.chartLabel,
        fontFamily: theme.text.family,
        margin: 12,

        // This was default with ChartZoom, we are making it default for all charts now
        // Otherwise the xAxis can look congested when there is always a min/max label
        showMaxLabel: false,
        showMinLabel: false,

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
    },
    props
  );
}

export default XAxis;
