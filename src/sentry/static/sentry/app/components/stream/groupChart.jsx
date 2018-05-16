import LazyLoad from 'react-lazyload';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import BarChart from 'app/components/barChart';

const StyledBarChart = styled(BarChart)`
  height: 24px;
`;

class GroupChart extends React.Component {
  static propTypes = {
    statsPeriod: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
  };

  shouldComponentUpdate(nextProps) {
    // Sometimes statsPeriod updates before graph data has been
    // pulled from server / propagated down to components ...
    // don't update until data is available
    let {data, statsPeriod} = nextProps;
    return data.hasOwnProperty(statsPeriod);
  }

  render() {
    let stats = this.props.statsPeriod
      ? this.props.data.stats[this.props.statsPeriod]
      : null;
    if (!stats || !stats.length) return null;

    let chartData = stats.map(point => {
      return {x: point[0], y: point[1]};
    });

    return (
      <LazyLoad debounce={50} height={24}>
        <StyledBarChart points={chartData} label="events" />
      </LazyLoad>
    );
  }
}

export default GroupChart;
