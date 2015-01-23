/*** @jsx React.DOM */
var React = require("react");

var PropTypes = require("../../proptypes");

var AggregateActivity = React.createClass({
  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired
  },

  render: function() {
    return (
      <div className="box">
        <div className="box-header">
            <h3>Activity</h3>
        </div>
        <div className="box-content with-padding">

        </div>
      </div>
    );
  }

});

module.exports = AggregateActivity;

