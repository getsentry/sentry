/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var AssigneeSelector = require("../assigneeSelector");
var Count = require("../count");
var TimeSince = require("../timeSince");

var AggregateHeader = React.createClass({
  propTypes: {
    aggregate: React.PropTypes.shape({
      id: React.PropTypes.string.isRequired
    }).isRequired,
    memberList: React.PropTypes.instanceOf(Array).isRequired,
    statsPeriod: React.PropTypes.string.isRequired
  },

  render: function() {
    var data = this.props.aggregate,
        userCount = 0;

    var chartData = data.stats[this.props.statsPeriod].map(function(point){
      return {x: point[0], y: point[1]};
    });

    if (data.tags["sentry:user"] !== undefined) {
      userCount = data.tags["sentry:user"].count;
    }

    var className = "group-detail";
    if (data.isBookmarked) {
      className += " isBookmarked";
    }
    if (data.hasSeen) {
      className += " hasSeen";
    }
    if (data.status === "resolved") {
      className += " isResolved";
    }

    return (
      <div className={className}>
        <div className="row">
          <div className="col-sm-8 details">
            <h3>
              <span className="icon icon-bookmark"></span>
              {data.title}
            </h3>
            <div className="event-message">
              <span className="message">{data.culprit}</span>
            </div>
            <div className="event-meta">
              <span className="last-seen"><TimeSince date={data.lastSeen} /></span>
              &nbsp;&mdash;&nbsp;
              <span className="first-seen">from <TimeSince date={data.firstSeen} /></span>
            </div>
          </div>
          <div className="col-sm-4 stats">
            <div className="row">
              <div className="col-xs-4 assigned-to">
                <AssigneeSelector
                    aggregate={data}
                    memberList={this.props.memberList} />
                <div className="is-assigned"><span className="hidden-sm">is</span> assigned</div>
              </div>
              <div className="col-xs-4 event-count align-right">
                <Count value={data.count} />
                events
              </div>
              <div className="col-xs-4 user-count align-right">
                <Count value={userCount} />
                users
              </div>
            </div>
          </div>
        </div>
        <div className="seen-by">
          <ul>
            <li>Seen by:</li>
          </ul>
        </div>
        <div className="group-actions">
          <div className="btn-group">
            <a href="#" className="group-resolve btn btn-default btn-sm"
               data-action="resolve"><span className="icon-checkmark"></span></a>
            <a href="#" className="group-bookmark btn btn-default btn-sm"
               data-action="bookmark"><span className="icon-bookmark"></span></a>
          </div>
          <div className="btn-group">
            <a href="#" className="group-remove btn btn-default btn-sm"
               data-action="remove"><span className="icon-trash"></span></a>
          </div>
          <div className="btn-group more">
            <a href="#" className="btn btn-default btn-sm dropdown-toggle">More <span className="icon-arrow-down"></span></a>
            <ul className="dropdown-menu">
            </ul>
          </div>
        </div>
      </div>
    );
  }
});

module.exports = AggregateHeader;
