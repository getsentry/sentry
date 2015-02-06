/*** @jsx React.DOM */

var React = require("react");

var PropTypes = require("../../proptypes");

var AggregateEventToolbar  = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    aggregate: PropTypes.Aggregate.isRequired,
    event: PropTypes.Event.isRequired,
  },

  render() {
    var orgId = this.props.orgId;
    var projectId = this.props.projectId;
    var aggId = this.props.aggregate.id;
    var evt = this.props.event;

    var eventNavNodes = [
      (evt.nextEventID ?
        <Router.Link
            key="next"
            to="aggregateEventDetails"
            params={{orgId: orgId,
                     projectId: projectId,
                     aggregateId: aggId,
                     eventId: evt.nextEventID}}
            className="btn btn-default btn-lg">Newer</Router.Link>
      :
        <a key="next"
           className="btn btn-default btn-lg disabled">Newer</a>
      ),
      (evt.previousEventID ?
        <Router.Link
            key="prev"
            to="aggregateEventDetails"
            params={{orgId: orgId,
                     projectId: projectId,
                     aggregateId: aggId,
                     eventId: evt.previousEventID}}
            className="btn btn-default btn-lg">Older</Router.Link>
      :
        <a key="prev"
           className="btn btn-default btn-lg disabled">Older</a>
      ),
    ];

    return (
      <div className="event-toolbar">
        <div className="pull-right">
          <div className="btn-group">
            {eventNavNodes}
          </div>
        </div>
        <ul className="nav nav-tabs">
          <li className="active"><a href="#">Tags</a></li>
          <li><a href="#">Exception</a></li>
          <li><a href="#">Request</a></li>
          <li><a href="#">Additional Data</a></li>
        </ul>
      </div>
    );
  }
});

module.exports = AggregateEventToolbar ;
