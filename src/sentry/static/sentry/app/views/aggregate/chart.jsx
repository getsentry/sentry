/*** @jsx React.DOM */
var React = require("react");

var BarChart = require("../../components/barChart");
var PropTypes = require("../../proptypes");

var AggregateChart = React.createClass({
  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired,
    statsPeriod: React.PropTypes.string.isRequired
  },

  render: function() {
    var aggregate = this.props.aggregate;
    var stats = aggregate.stats[this.props.statsPeriod];
    var points = stats.map((point) => {
      return {x: point[0], y: point[1]};
    });

    return (
      <div className="group-chart">
        <h6>Last 48 Hours</h6>
        <BarChart points={points} className="sparkline" />
      </div>
    );
  }

});

module.exports = AggregateChart;
