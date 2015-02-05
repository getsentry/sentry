/*** @jsx React.DOM */

var React = require("react");

var api = require("../../api");
var AssigneeSelector = require("../../components/assigneeSelector");
var Count = require("../../components/count");
var PropTypes = require("../../proptypes");
var TimeSince = require("../../components/timeSince");

var AggregateHeader = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    aggregate: PropTypes.Aggregate.isRequired,
    memberList: React.PropTypes.instanceOf(Array).isRequired,
    statsPeriod: React.PropTypes.string.isRequired
  },

  onToggleResolve() {
    api.bulkUpdate({
      orgId: this.props.orgId,
      projectId: this.props.projectId,
      itemIds: [this.props.aggregate.id],
      data: {
        status: this.props.aggregate.status === 'resolved' ? 'unresolved' : 'resolved'
      }
    });
  },

  onToggleBookmark() {
    api.bulkUpdate({
      orgId: this.props.orgId,
      projectId: this.props.projectId,
      itemIds: [this.props.aggregate.id],
      data: {
        isBookmarked: !this.props.aggregate.isBookmarked
      }
    });
  },
  render() {
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

    var resolveClassName = "group-resolve btn btn-default btn-sm";
    if (data.status === "resolved") {
      resolveClassName += " active";
    }

    var bookmarkClassName = "group-bookmark btn btn-default btn-sm";
    if (data.isBookmarked) {
      bookmarkClassName += " active";
    }

    return (
      <div className={className}>
        <div className="row">
          <div className="col-sm-8 details">
            <h3>
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
              <div className="col-xs-4 count align-right">
                <Count value={data.count} />
                <span className="count-label">events</span>
              </div>
              <div className="col-xs-4 count align-right">
                <Count value={userCount} />
                <span className="count-label">users</span>
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
            <a className={resolveClassName}
               onClick={this.onToggleResolve}>
              <span className="icon-checkmark"></span>
            </a>
            <a className={bookmarkClassName}
               onClick={this.onToggleBookmark}>
              <span className="icon-bookmark"></span>
            </a>
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
        <ul className="nav nav-tabs">
          <li className="active"><a href="#">Overview</a></li>
          <li><a href="#">Tags</a></li>
          <li><a href="#">Similar Events</a></li>
        </ul>
      </div>
    );
  }
});

module.exports = AggregateHeader;
