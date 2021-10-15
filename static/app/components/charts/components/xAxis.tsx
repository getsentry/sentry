import {EChartOption} from 'echarts';
import merge from 'lodash/merge';

import BaseChart from 'app/components/charts/baseChart';
import {getFormattedDate, getTimeFormat} from 'app/utils/dates';
import {Theme} from 'app/utils/theme';

import {truncationFormatter, useShortInterval} from '../utils';

type ChartProps = React.ComponentProps<typeof BaseChart>;
type HelperProps =
  | 'isGroupedByDate'
  | 'useShortDate'
  | 'addSecondsToTimeFormat'
  | 'start'
  | 'end'
  | 'period'
  | 'utc';

type Props = ChartProps['xAxis'] & Pick<ChartProps, HelperProps> & {theme: Theme};

function XAxis({
  isGroupedByDate,
  useShortDate,
  addSecondsToTimeFormat,
  theme,

  start,
  end,
  period,
  utc,
  ...props
}: Props): EChartOption.XAxis {
  const axisLabelFormatter = (value: string, index: number) => {
    if (isGroupedByDate) {
      const timeFormat = getTimeFormat(addSecondsToTimeFormat);
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
