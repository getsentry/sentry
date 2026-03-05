import type {AreaChartProps} from 'sentry/components/charts/areaChart';
import {AreaChart} from 'sentry/components/charts/areaChart';

function StackedAreaChart(props: AreaChartProps) {
  return <AreaChart tooltip={{filter: val => val > 0}} {...props} stacked />;
}

export default StackedAreaChart;
