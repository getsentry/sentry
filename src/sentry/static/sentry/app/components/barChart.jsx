import React from 'react';
import StackedBarChart from '../components/stackedBarChart';

const BarChart = React.createClass({
  propTypes: {
    points: React.PropTypes.arrayOf(React.PropTypes.shape({
      x: React.PropTypes.number.isRequired,
      y: React.PropTypes.number.isRequired,
      label: React.PropTypes.string
    })),
    interval: React.PropTypes.string,
    height: React.PropTypes.number,
    width: React.PropTypes.number,
    placement: React.PropTypes.string,
    label: React.PropTypes.string,
    markers: React.PropTypes.arrayOf(React.PropTypes.shape({
      x: React.PropTypes.number.isRequired,
      label: React.PropTypes.string
    }))
  },

  getDefaultProps() {
    return {
      points: [],
    };
  },


  render() {
    let points = this.props.points.map((point) => {
      return {x: point.x, y: [point.y]};
    });
    let props = Object.assign({}, this.props, {points: points});
    return <StackedBarChart {...props} />;
  }

});

export default BarChart;
