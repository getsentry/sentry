// TODO(matej): this is very similar to app/components/stream/groupChart, will refactor to reusable component in a follow-up PR
import React from 'react';
import LazyLoad from 'react-lazyload';

import {t} from 'app/locale';
import BarChart from 'app/components/barChart';

type DefaultProps = {
  height: number;
};

type Props = DefaultProps & {
  statsPeriod: '24h' | '14d';
  data: {
    [statsPeriod: string]: [number, number][];
  };
};

class UsersChart extends React.Component<Props> {
  static defaultProps: DefaultProps = {
    height: 24,
  };

  shouldComponentUpdate(nextProps: Props) {
    // Sometimes statsPeriod updates before graph data has been
    // pulled from server / propagated down to components ...
    // don't update until data is available
    const {data, statsPeriod} = nextProps;
    return data.hasOwnProperty(statsPeriod);
  }

  render() {
    const {height, statsPeriod, data} = this.props;

    const stats = statsPeriod ? data[statsPeriod] : null;

    if (!stats || !stats.length) {
      return null;
    }

    const chartData = stats.map(point => {
      return {x: point[0], y: point[1]};
    });

    return (
      <LazyLoad debounce={50} height={height}>
        <BarChart
          points={chartData}
          height={height}
          label={t('users')}
          minHeights={[3]}
          gap={1}
        />
      </LazyLoad>
    );
  }
}

export default UsersChart;
