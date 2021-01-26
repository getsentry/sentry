import 'echarts/lib/component/legend';
import 'echarts/lib/component/legendScroll';

import {EChartOption} from 'echarts';

import BaseChart from 'app/components/charts/baseChart';
import {Theme} from 'app/utils/theme';

import {truncationFormatter} from '../utils';

type ChartProps = React.ComponentProps<typeof BaseChart>;

export default function Legend(
  props: ChartProps['legend'] & {theme?: Theme} = {}
): EChartOption.Legend {
  const {truncate, theme, ...rest} = props ?? {};
  const formatter = (value: string) => truncationFormatter(value, truncate ?? 0);

  return {
    show: true,
    type: 'scroll',
    padding: 0,
    formatter,
    icon: 'circle',
    itemHeight: 8,
    itemWidth: 8,
    itemGap: 12,
    align: 'left' as const,
    textStyle: {
      color: theme?.textColor,
      verticalAlign: 'top',
      fontSize: 11,
      fontFamily: 'Rubik',
    },
    inactiveColor: theme?.inactive,
    ...rest,
  };
}
