import LazyLoad from 'react-lazyload';
import PropTypes from 'prop-types';
import React from 'react';

import {Group, GroupStats} from 'app/types';
import BarChart from 'app/components/barChart';

const defaultProps = {
  height: 24,
};

type Props = {
  statsPeriod: string;
  data: Group;
  hasDynamicIssueCounts?: boolean;
} & typeof defaultProps;

class GroupChart extends React.Component<Props> {
  static propTypes = {
    statsPeriod: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
    height: PropTypes.number,
    hasDynamicIssueCounts: PropTypes.bool,
  };

  static defaultProps = defaultProps;

  render() {
    const {data, hasDynamicIssueCounts, height, statsPeriod} = this.props;
    // TODO: @taylangocmen pass filtered and unfiltered stats separately to chart and render both

    const stats: GroupStats[] = statsPeriod
      ? hasDynamicIssueCounts && data.filtered
        ? data.filtered.stats[statsPeriod]
        : data.stats[statsPeriod]
      : null;

    if (!stats || !stats.length) {
      return null;
    }
    const chartData = stats.map(point => ({x: point[0], y: point[1]}));

    return (
      <LazyLoad debounce={50} height={height}>
        <BarChart
          points={chartData}
          height={height}
          label="events"
          minHeights={[3]}
          gap={1}
        />
      </LazyLoad>
    );
  }
}

export default GroupChart;
