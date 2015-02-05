/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var PropTypes = require("../proptypes");

var AggregateEvents = React.createClass({
  mixins: [Router.State],

  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired
  },

  render() {
    return (
      <div>
      Events
      </div>
    );
  }
});

module.exports = AggregateEvents;
