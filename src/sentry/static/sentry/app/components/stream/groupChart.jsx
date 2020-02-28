import LazyLoad from 'react-lazyload';
import PropTypes from 'prop-types';
import React from 'react';

import BarChart from 'app/components/barChart';

class GroupChart extends React.Component {
  static propTypes = {
    statsPeriod: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
    height: PropTypes.number,
  };

  static defaultProps = {
    height: 24,
  };

  shouldComponentUpdate(nextProps) {
    // Sometimes statsPeriod updates before graph data has been
    // pulled from server / propagated down to components ...
    // don't update until data is available
    const {data, statsPeriod} = nextProps;
    return data.hasOwnProperty(statsPeriod);
  }

  render() {
    const stats = this.props.statsPeriod
      ? this.props.data.stats[this.props.statsPeriod]
      : null;
    if (!stats || !stats.length) {
      return null;
    }
    const {height} = this.props;
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
