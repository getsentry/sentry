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
  const {truncate, theme, textStyle, ...rest} = props ?? {};
  const formatter = (value: string) => truncationFormatter(value, truncate ?? 0);

  const newTextStyle = {
    color: theme?.textColor,
    verticalAlign: 'top',
    fontSize: 11,
    fontFamily: 'Rubik',
    ...textStyle,
  };

  const legend = {
    show: true,
    type: 'scroll' as const,
    padding: 0,
    formatter,
    icon: 'circle',
    itemHeight: 8,
    itemWidth: 8,
    itemGap: 12,
    align: 'left' as const,
    textStyle: newTextStyle,
    inactiveColor: theme?.inactive,
    ...rest,
  };

  if (theme === undefined) {
    delete newTextStyle.color;
    delete legend.inactiveColor;
  }

  return legend;
}
