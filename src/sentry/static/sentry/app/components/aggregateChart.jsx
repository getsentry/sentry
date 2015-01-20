/*** @jsx React.DOM */
var React = require("react");

var FlotChart = require("./flotChart");

var AggregateChart = React.createClass({
  propTypes: {
    aggregate: React.PropTypes.shape({
      id: React.PropTypes.string.isRequired
    }).isRequired,
    project: React.PropTypes.shape({
      id: React.PropTypes.string.isRequired
    }).isRequired
  },

  render: function() {
    var points = [{x: 1421722207, y: 50}, {x: 1421722267, y: 150}];

    return (
      <FlotChart
          points={points}
          className="chart" />
    );
  }

});

module.exports = AggregateChart;
