/*** @jsx React.DOM */
var React = require("react");

var PropTypes = require("../../proptypes");

var AggregateEventHeader = React.createClass({
  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired,
    event: PropTypes.Event
  },

  render: function() {
    var event = this.props.event;

    if (!event) {
      return <div />;
    }

    return (
      <div className="btn-toolbar event-toolbar">
        <a className="btn btn-default btn-lg pull-left prev">
          <span></span> Newer Sample
        </a>
        <a className="btn btn-default btn-lg pull-right next">
          Older Sample <span></span>
        </a>
        <h4>
          <span>Datetime</span>
          <span>[{event.size}]</span>
          <div>
            <small>ID: {event.eventID}</small>
          </div>
        </h4>
      </div>
    );
  }
});

module.exports = AggregateEventHeader;

