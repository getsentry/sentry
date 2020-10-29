// TODO(matej): this is very similar to app/components/stream/groupChart, will refactor to reusable component in a follow-up PR
import React from 'react';
import LazyLoad from 'react-lazyload';

import {Series} from 'app/types/echarts';
import {t} from 'app/locale';
import MiniBarChart from 'app/components/charts/miniBarChart';
import theme from 'app/utils/theme';

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

class HealthStatsChart extends React.Component<Props> {
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
      return t('Users');
    }

    return t('Sessions');
  }

  render() {
    const {height, period, data} = this.props;
    const stats = period ? data[period] : null;
    if (!stats || !stats.length) {
      return null;
    }

    const colors = [theme.gray500];
    const emphasisColors = [theme.purple400];
    const series: Series[] = [
      {
        seriesName: this.getChartLabel(),
        data: stats.map(point => ({name: point[0] * 1000, value: point[1]})),
      },
    ];

    return (
      <LazyLoad debounce={50} height={height}>
        <MiniBarChart
          series={series}
          height={height}
          colors={colors}
          emphasisColors={emphasisColors}
          isGroupedByDate
          showTimeInTooltip
        />
      </LazyLoad>
    );
  }
}

export default HealthStatsChart;
