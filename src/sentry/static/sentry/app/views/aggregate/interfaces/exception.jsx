/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var AggregateEventDataSection = require("../eventDataSection");
var PropTypes = require("../../../proptypes");

var ExceptionInterface = React.createClass({
  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired,
    event: PropTypes.Event.isRequired,
    data: React.PropTypes.object.isRequired
  },

  render: function(){
    var agg = this.props.aggregate;
    var evt = this.props.event;

    return (
      <AggregateEventDataSection
          aggregate={agg}
          event={evt}
          title="Exception">
      </AggregateEventDataSection>
    );
  }
});

module.exports = ExceptionInterface;
