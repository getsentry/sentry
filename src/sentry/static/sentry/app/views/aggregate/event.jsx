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

  render(){
    var agg = this.props.aggregate;
    var evt = this.props.event;

    var entries = [];
    evt.entries.forEach((entry, entryIdx) => {
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
    });

    return (
      <div className="row">
        <div className="col-md-9">
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
        <div className="col-md-3 event-stats">
          <h6>Sample ID</h6>
          <p><strong>{evt.eventID}</strong></p>

          <h6>Time</h6>
          <p><strong>{evt.dateCreated}</strong></p>

          <h6>User</h6>
          <p><strong><a href="#">tony@hawk.com</a></strong></p>
        </div>
      </div>
    );
  }
});

module.exports = AggregateEvent;
