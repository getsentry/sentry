import React from "react";
import Router from "react-router";
import api from "../../api";
import AssigneeSelector from "../../components/assigneeSelector";
import Count from "../../components/count";
import GroupActions from "./actions";
import GroupSeenBy from "./seenBy";
import IndicatorStore from "../../stores/indicatorStore";
import ListLink from "../../components/listLink";
import ProjectState from "../../mixins/projectState";

var GroupHeader = React.createClass({
  mixins: [ProjectState],

  contextTypes: {
    router: React.PropTypes.func.isRequired
  },

  propTypes: {
    memberList: React.PropTypes.instanceOf(Array).isRequired
  },

  onToggleMute() {
    var group = this.props.group;
    var project = this.getProject();
    var org = this.getOrganization();
    var loadingIndicator = IndicatorStore.add('Saving changes..');

    api.bulkUpdate({
      orgId: org.slug,
      projectId: project.slug,
      itemIds: [group.id],
      data: {
        status: group.status === 'muted' ? 'unresolved' : 'muted'
      }
    }, {
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  onShare() {
    return this.context.router.transitionTo('sharedGroupDetails', {
      shareId: this.props.group.shareId
    });
  },

  onTogglePublic() {
    var group = this.props.group;
    var project = this.getProject();
    var org = this.getOrganization();
    var loadingIndicator = IndicatorStore.add('Saving changes..');

    api.bulkUpdate({
      orgId: org.slug,
      projectId: project.slug,
      itemIds: [group.id],
      data: {
        isPublic: !group.isPublic
      }
    }, {
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  render() {
    var group = this.props.group,
        userCount = 0,
        features = this.getProjectFeatures();

    if (group.tags.user !== undefined) {
      userCount = group.tags.user.count;
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

    var params = this.context.router.getCurrentParams();

    return (
      <div className={className}>
        <div className="row">
          <div className="col-sm-8">
            <h3>
              {group.title}
            </h3>
            <div className="event-message">
              <span className="message">{group.culprit}</span>
              {group.logger &&
                <span className="event-annotation">
                  <Router.Link to="stream" params={params} query={{query: "logger:" + group.logger}}>
                    {group.logger}
                  </Router.Link>
                </span>
              }
              {group.annotations.map((annotation) => {
                return (
                  <span className="event-annotation"
                      dangerouslySetInnerHTML={{__html: annotation}} />
                );
              })}
            </div>
          </div>
          <div className="col-sm-4 stats">
            <div className="row">
              <div className="col-xs-4 assigned-to">
                <h6 className="nav-header">Assigned</h6>
                <AssigneeSelector id={group.id} />
              </div>
              <div className="col-xs-4 count align-right">
                <h6 className="nav-header">Events</h6>
                <Count className="count" value={group.count} />
              </div>
              <div className="col-xs-4 count align-right">
                <h6 className="nav-header">Users</h6>
                <Count className="count" value={userCount} />
              </div>
            </div>
          </div>
        </div>
        <GroupSeenBy />
        <GroupActions />
        <div className="pull-right">
          <div className={(group.status === 'muted' ? 'on ' : '') + 'group-notifications'}>
            <a onClick={this.onToggleMute}>
              <span className="icon" />
              {group.status !== 'muted' ?
                'Mute notifications'
              :
                'Un-mute notifications'
              }
            </a>
          </div>
          <div className="group-privacy">
            <a onClick={this.onShare}>
              <span className="icon" /> Share this event
            </a>
          </div>
        </div>
        <ul className="nav nav-tabs">
          <ListLink to="groupOverview" params={params} isActive={function (to) {
            // "Details" tab is active for overview *or* event details
            let router = this.context.router;
            return router.isActive('groupOverview') || router.isActive('groupEventDetails');
          }}>
            Details
          </ListLink>
          <ListLink to="groupActivity" params={params}>
            Comments <span className="badge animated">{group.numComments}</span>
          </ListLink>
          {features.has('user-reports') &&
            <ListLink to="groupUserReports" params={params}>
              User Reports <span className="badge animated">{group.userReportCount}</span>
            </ListLink>
          }
          <ListLink to="groupTags" params={params}>
            Tags
          </ListLink>
          <ListLink to="groupEvents" params={params}>
            Similar Events
          </ListLink>
        </ul>
      </div>
    );
  }
});

export default GroupHeader;
