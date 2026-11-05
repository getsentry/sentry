import type {AreaChartProps} from './areaChart';
import {AreaChart} from './areaChart';

export function StackedAreaChart(props: AreaChartProps) {
  return <AreaChart tooltip={{filter: val => val > 0}} {...props} stacked />;
}
