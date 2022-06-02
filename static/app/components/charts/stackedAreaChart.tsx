import {Component} from 'react';

import {AreaChart} from 'sentry/components/charts/areaChart';

type AreaChartProps = React.ComponentProps<typeof AreaChart>;

type Props = Omit<AreaChartProps, 'stacked' | 'ref'>;

class StackedAreaChart extends Component<Props> {
  render() {
    return <AreaChart tooltip={{filter: val => val > 0}} {...this.props} stacked />;
  }
}

export default StackedAreaChart;
