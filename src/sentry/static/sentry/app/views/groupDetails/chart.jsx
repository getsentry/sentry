/*** @jsx React.DOM */
var React = require("react");

var BarChart = require("../../components/barChart");
var GroupState = require("../../mixins/groupState");
var PropTypes = require("../../proptypes");

var GroupChart = React.createClass({
  mixins: [GroupState],

  render: function() {
    var group = this.getGroup();
    var stats_24h = group.stats['24h'];
    var points_24h = stats_24h.map((point) => {
      return {x: point[0], y: point[1]};
    });

    var stats_30d = group.stats['30d'];
    var points_30d = stats_30d.map((point) => {
      return {x: point[0], y: point[1]};
    });


    return (
      <div className="bar-chart group-chart">
        <h6>Last 24 hours</h6>
        <BarChart points={points_24h} className="sparkline" />

        <h6>Last 30 Days</h6>
        <BarChart points={points_30d} className="sparkline small" />
      </div>
    );
  }

});

module.exports = GroupChart;
