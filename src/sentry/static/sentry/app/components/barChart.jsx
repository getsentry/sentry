import PropTypes from 'prop-types';
import React from 'react';
import StackedBarChart from '../components/stackedBarChart';

const BarChart = React.createClass({
  propTypes: {
    points: PropTypes.arrayOf(
      PropTypes.shape({
        x: PropTypes.number.isRequired,
        y: PropTypes.number.isRequired,
        label: PropTypes.string
      })
    ),
    interval: PropTypes.string,
    height: PropTypes.number,
    width: PropTypes.number,
    placement: PropTypes.string,
    label: PropTypes.string,
    markers: PropTypes.arrayOf(
      PropTypes.shape({
        x: PropTypes.number.isRequired,
        label: PropTypes.string
      })
    )
  },

  getDefaultProps() {
    return {
      points: []
    };
  },

  render() {
    let points = this.props.points.map(point => {
      return {x: point.x, y: [point.y]};
    });
    let props = Object.assign({}, this.props, {points: points});
    return <StackedBarChart {...props} />;
  }
});

export default BarChart;
