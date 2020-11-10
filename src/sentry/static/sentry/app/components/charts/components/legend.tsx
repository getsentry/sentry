import {EChartOption} from 'echarts';
import 'echarts/lib/component/legend';
import 'echarts/lib/component/legendScroll';

import BaseChart from 'app/components/charts/baseChart';

import {truncationFormatter} from '../utils';

type ChartProps = React.ComponentProps<typeof BaseChart>;

export default function Legend(props: ChartProps['legend'] = {}): EChartOption.Legend {
  const {truncate, ...rest} = props ?? {};
  const formatter = (value: string) => truncationFormatter(value, truncate ?? 0);

  return {
    show: true,
    type: 'scroll',
    padding: 0,
    formatter,
    ...rest,
  };
}
