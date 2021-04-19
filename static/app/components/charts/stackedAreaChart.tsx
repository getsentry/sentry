import React from 'react';

import AreaChart from 'app/components/charts/areaChart';

type AreaChartProps = React.ComponentProps<typeof AreaChart>;

type Props = Omit<AreaChartProps, 'stacked' | 'tooltip' | 'ref'>;

class StackedAreaChart extends React.Component<Props> {
  render() {
    return <AreaChart tooltip={{filter: val => val > 0}} {...this.props} stacked />;
  }
}

export default StackedAreaChart;
