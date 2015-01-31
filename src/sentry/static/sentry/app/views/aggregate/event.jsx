/*** @jsx React.DOM */

var React = require("react");

var AggregateEventDataSection = require("./eventDataSection");
var AggregateEventHeader = require("./eventHeader");
var AggregateEventTags = require("./eventTags");
var PropTypes = require("../../proptypes");

var AggregateEvent = React.createClass({
  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired,
    event: PropTypes.Event.isRequired
  },

  // TODO(dcramer): figure out how we make this extensible
  interfaces: {
    exception: require("./interfaces/exception"),
    request: require("./interfaces/request")
  },

  render: function(){
    var agg = this.props.aggregate;
    var evt = this.props.event;

    var entries = [];
    evt.entries.forEach(function(entry, entryIdx){
      try {
        var Component = this.interfaces[entry.type];
        if (!Component) {
          throw new Error('Unregistered interface: ' + entry.type);

        }
        entries.push(
          <Component
              key={"entry-" + entryIdx}
              aggregate={agg}
              event={evt}
              data={entry.data} />
        );
      } catch (ex) {
        // TODO(dcramer): this should log to Sentry
        console.error(ex);
      }
    }.bind(this));

    return (
      <div>
        <AggregateEventHeader
            aggregate={agg}
            event={evt} />
        <AggregateEventTags
            aggregate={agg}
            event={evt} />
        {entries}
        <AggregateEventDataSection
            aggregate={agg}
            event={evt}
            title="Additional Data" />
      </div>
    );
  }
});

module.exports = AggregateEvent;
