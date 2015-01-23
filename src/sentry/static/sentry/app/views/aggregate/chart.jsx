/*** @jsx React.DOM */
var React = require("react");

var FlotChart = require("../../components/flotChart");
var PropTypes = require("../../proptypes");

var AggregateChart = React.createClass({
  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired,
    statsPeriod: React.PropTypes.string.isRequired
  },

  render: function() {
    var aggregate = this.props.aggregate;
    var points = aggregate.stats[this.props.statsPeriod].map(function(point){
      return {x: point[0], y: point[1]};
    });

    return (
      <div className="box">
        <div className="box-content with-padding">
          <FlotChart
              points={points}
              className="chart" />
        </div>
      </div>
    );
  }

});

module.exports = AggregateChart;
