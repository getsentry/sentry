import {EChartOption} from 'echarts';

import {getFormattedDate, getTimeFormat} from 'app/utils/dates';
import BaseChart from 'app/components/charts/baseChart';
import theme from 'app/utils/theme';

import {truncationFormatter, useShortInterval} from '../utils';

type ChartProps = React.ComponentProps<typeof BaseChart>;
type HelperProps =
  | 'isGroupedByDate'
  | 'useShortDate'
  | 'start'
  | 'end'
  | 'period'
  | 'utc';

type Props = ChartProps['xAxis'] & Pick<ChartProps, HelperProps>;

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
}: Props = {}): EChartOption.XAxis {
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

  return {
    type: isGroupedByDate ? 'time' : 'category',
    boundaryGap: false,
    axisLine: {
      lineStyle: {
        color: theme.gray400,
      },
      ...(axisLine || {}),
    },
    axisTick: {
      lineStyle: {
        color: theme.gray400,
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
