/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var api = require("../../api");
var AssigneeSelector = require("../../components/assigneeSelector");
var Count = require("../../components/count");
var GroupActions = require("./actions");
var GroupSeenBy = require("./seenBy");
var GroupState = require("../../mixins/groupState");
var ListLink = require("../../components/listLink");
var PropTypes = require("../../proptypes");
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

var GroupHeader = React.createClass({
  mixins: [PureRenderMixin],

  contextTypes: {
    router: React.PropTypes.func.isRequired
  },

  propTypes: {
    group: PropTypes.Group.isRequired,
    memberList: React.PropTypes.instanceOf(Array).isRequired,
    statsPeriod: React.PropTypes.string.isRequired
  },

  isEventDetailView() {
    var currentRoutes = this.context.router.getCurrentRoutes();
    return currentRoutes[currentRoutes.length - 1].name == 'groupEventDetails';
  },

  render() {
    var group = this.props.group,
        userCount = 0;

    var chartData = group.stats[this.props.statsPeriod].map(function(point){
      return {x: point[0], y: point[1]};
    });

    if (group.tags["sentry:user"] !== undefined) {
      userCount = group.tags["sentry:user"].count;
    }

    var className = "group-detail";
    if (group.isBookmarked) {
      className += " isBookmarked";
    }
    if (group.hasSeen) {
      className += " hasSeen";
    }
    if (group.status === "resolved") {
      className += " isResolved";
    }

    var groupRouteParams = this.context.router.getCurrentParams();

    return (
      <div className={className}>
        <div className="row">
          <div className="col-sm-8 details">
            <h3>
              {group.title}
            </h3>
            <div className="event-message">
              <span className="message">{group.culprit}</span>
            </div>
          </div>
          <div className="col-sm-4 stats">
            <div className="row">
              <div className="col-xs-4 assigned-to">
                <AssigneeSelector
                    group={group}
                    memberList={this.props.memberList} />
                <div className="is-assigned"><span className="hidden-sm">is</span> assigned</div>
              </div>
              <div className="col-xs-4 count align-right">
                <Count value={group.count} />
                <span className="count-label">events</span>
              </div>
              <div className="col-xs-4 count align-right">
                <Count value={userCount} />
                <span className="count-label">users</span>
              </div>
            </div>
          </div>
        </div>
        <GroupSeenBy />
        <GroupActions />
        <ul className="nav nav-tabs">
          <ListLink to="groupOverview" params={groupRouteParams}
                    className={this.isEventDetailView() ? 'active': ''}>
            Overview
          </ListLink>
          <ListLink to="groupTags" params={groupRouteParams}>
            Tags
          </ListLink>
          <ListLink to="groupEvents" params={groupRouteParams}>
            Similar Events
          </ListLink>
          <ListLink to="groupEvents" params={groupRouteParams}>
            Latest Event
          </ListLink>
        </ul>
      </div>
    );
  }
});

module.exports = GroupHeader;
