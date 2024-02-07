import {Component} from 'react';

import type {AreaChartProps} from 'sentry/components/charts/areaChart';
import {AreaChart} from 'sentry/components/charts/areaChart';

class StackedAreaChart extends Component<AreaChartProps> {
  render() {
    return <AreaChart tooltip={{filter: val => val > 0}} {...this.props} stacked />;
  }
}

export default StackedAreaChart;
