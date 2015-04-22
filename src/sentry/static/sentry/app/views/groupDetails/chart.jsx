/*** @jsx React.DOM */
var React = require("react");

var BarChart = require("../../components/barChart");
var PropTypes = require("../../proptypes");
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

var GroupChart = React.createClass({
  mixins: [PureRenderMixin],

  propTypes: {
    group: PropTypes.Group.isRequired,
  },

  render: function() {
    var group = this.props.group;
    var stats = group.stats['24h'];
    var points = stats.map((point) => {
      return {x: point[0], y: point[1]};
    });

    return (
      <div className="bar-chart group-chart">
        <h6>Last 24 Hours</h6>
        <BarChart points={points} className="sparkline" />
      </div>
    );
  }

});

module.exports = GroupChart;
