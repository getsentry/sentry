/*** @jsx React.DOM */
var React = require("react");

var BarChart = require("../../components/barChart");
var GroupState = require("../../mixins/groupState");
var PropTypes = require("../../proptypes");

var GroupChart = React.createClass({
  mixins: [GroupState],

  propTypes: {
    statsPeriod: React.PropTypes.string.isRequired
  },

  render: function() {
    var group = this.getGroup();
    var stats = group.stats[this.props.statsPeriod];
    var points = stats.map((point) => {
      return {x: point[0], y: point[1]};
    });

    return (
      <div className="bar-chart group-chart">
        <h6>Last 48 Hours</h6>
        <BarChart points={points} className="sparkline" />
      </div>
    );
  }

});

module.exports = GroupChart;
