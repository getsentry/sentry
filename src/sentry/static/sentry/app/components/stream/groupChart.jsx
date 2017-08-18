import LazyLoad from 'react-lazy-load';
import PropTypes from 'prop-types';
import React from 'react';
import BarChart from '../barChart';

const GroupChart = React.createClass({
  propTypes: {
    statsPeriod: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired
  },

  shouldComponentUpdate(nextProps) {
    // Sometimes statsPeriod updates before graph data has been
    // pulled from server / propagated down to components ...
    // don't update until data is available
    let {data, statsPeriod} = nextProps;
    return data.hasOwnProperty(statsPeriod);
  },

  render() {
    let stats = this.props.statsPeriod
      ? this.props.data.stats[this.props.statsPeriod]
      : null;
    if (!stats || !stats.length) return null;

    let chartData = stats.map(point => {
      return {x: point[0], y: point[1]};
    });

    return (
      <LazyLoad>
        <BarChart points={chartData} label="events" />
      </LazyLoad>
    );
  }
});

export default GroupChart;
