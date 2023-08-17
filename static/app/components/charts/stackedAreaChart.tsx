import {Component} from 'react';

import {AreaChart, AreaChartProps} from 'sentry/components/charts/areaChart';

class StackedAreaChart extends Component<AreaChartProps> {
  render() {
    return <AreaChart tooltip={{filter: val => val > 0}} {...this.props} stacked />;
  }
}

export default StackedAreaChart;
