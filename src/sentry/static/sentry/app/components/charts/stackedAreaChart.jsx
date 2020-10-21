import {Component} from 'react';

import AreaChart from 'app/components/charts/areaChart';

class StackedAreaChart extends Component {
  render() {
    return <AreaChart tooltip={{filter: val => val > 0}} {...this.props} stacked />;
  }
}

export default StackedAreaChart;
