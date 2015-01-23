/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var AggregateEventDataSection = require("./eventDataSection");
var AggregateEventHeader = require("./eventHeader");
var AggregateEventTags = require("./eventTags");
var PropTypes = require("../../proptypes");

var AggregateEvent = React.createClass({
  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired,
    event: PropTypes.Event.isRequired
  },

  render: function(){
    var agg = this.props.aggregate;
    var evt = this.props.event;

    return (
      <div>
        <AggregateEventHeader
            aggregate={agg}
            event={evt} />
        <AggregateEventTags
            aggregate={agg}
            event={evt} />
        <AggregateEventDataSection
            aggregate={agg}
            event={evt}
            title="Additional Data" />
      </div>
    );
  }
});

module.exports = AggregateEvent;
