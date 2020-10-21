// TODO(matej): this is very similar to app/components/stream/groupChart, will refactor to reusable component in a follow-up PR
import { Component } from 'react';
import LazyLoad from 'react-lazyload';

import {t} from 'app/locale';
import BarChart from 'app/components/barChart';

import {StatsSubject} from './healthStatsSubject';
import {StatsPeriod} from './healthStatsPeriod';

type DefaultProps = {
  height: number;
};

type Props = DefaultProps & {
  period: StatsPeriod;
  subject: StatsSubject;
  data: {
    [statsPeriod: string]: [number, number][];
  };
};

class HealthStatsChart extends Component<Props> {
  static defaultProps: DefaultProps = {
    height: 24,
  };

  shouldComponentUpdate(nextProps: Props) {
    // Sometimes statsPeriod updates before graph data has been
    // pulled from server / propagated down to components ...
    // don't update until data is available
    const {data, period} = nextProps;
    return data.hasOwnProperty(period);
  }

  getChartLabel() {
    const {subject} = this.props;
    if (subject === 'users') {
      return t('users');
    }

    return t('sessions');
  }

  render() {
    const {height, period, data} = this.props;

    const stats = period ? data[period] : null;

    if (!stats || !stats.length) {
      return null;
    }

    const chartData = stats.map(point => ({x: point[0], y: point[1]}));

    return (
      <LazyLoad debounce={50} height={height}>
        <BarChart
          points={chartData}
          height={height}
          label={this.getChartLabel()}
          minHeights={[3]}
          gap={1}
        />
      </LazyLoad>
    );
  }
}

export default HealthStatsChart;
