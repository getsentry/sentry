import React from 'react';

import AreaChart from 'app/components/charts/areaChart';

class StackedAreaChart extends React.Component {
  render() {
    return <AreaChart tooltip={{filter: val => val > 0}} {...this.props} stacked />;
  }
}

export default StackedAreaChart;
