import React from "react";
// import Router from "react-router";
import {Link, History} from "react-router";
import api from "../../api";
import AssigneeSelector from "../../components/assigneeSelector";
import Count from "../../components/count";
import GroupActions from "./actions";
import GroupSeenBy from "./seenBy";
import IndicatorStore from "../../stores/indicatorStore";
import ListLink from "../../components/listLink";
import ProjectState from "../../mixins/projectState";

var GroupHeader = React.createClass({
  propTypes: {
    memberList: React.PropTypes.instanceOf(Array).isRequired
  },

  contextTypes: {
    location: React.PropTypes.object
  },

  mixins: [
    ProjectState,
    History
  ],

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
    let {shareId} = this.props.group;
    return this.history.pushState(null, `/share/group/${shareId}/`);
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
        userCount = group.userCount,
        features = this.getProjectFeatures();

    var className = "group-detail level-" + group.level;
    if (group.isBookmarked) {
      className += " isBookmarked";
    }
    if (group.hasSeen) {
      className += " hasSeen";
    }
    if (group.status === "resolved") {
      className += " isResolved";
    }

    let groupId = group.id,
      projectId = this.getProject().slug,
      orgId = this.getOrganization().slug;

    return (
      <div className={className}>
        <div className="row">
          <div className="col-sm-8">
            <h3>
              {group.title}
            </h3>
            <div className="event-message">
              <span className="error-level">{group.level}</span>
              <span className="message">{group.culprit}</span>
              {group.logger &&
                <span className="event-annotation">
                  <Link to={`/${orgId}/${projectId}/`} query={{query: "logger:" + group.logger}}>
                    {group.logger}
                  </Link>
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
          <ListLink to={`/${orgId}/${projectId}/group/${groupId}/`} isActive={function (to) {
            let rootGroupPath = `/${orgId}/${projectId}/group/${groupId}/`;
            let pathname = this.context.location.pathname;

            // Because react-router 1.0 removes router.isActive(route)
            return pathname === rootGroupPath || /events\/\w+\/$/.test(pathname);
          }.bind(this)}>
            Details
          </ListLink>
          <ListLink to={`/${orgId}/${projectId}/group/${groupId}/activity/`}>
            Comments <span className="badge animated">{group.numComments}</span>
          </ListLink>
          {features.has('user-reports') &&
            <ListLink to={`/${orgId}/${projectId}/group/${groupId}/reports/`}>
              User Reports <span className="badge animated">{group.userReportCount}</span>
            </ListLink>
          }
          <ListLink to={`/${orgId}/${projectId}/group/${groupId}/tags/`}>
            Tags
          </ListLink>
          <ListLink to={`/${orgId}/${projectId}/group/${groupId}/events/`}>
            Similar Events
          </ListLink>
        </ul>
      </div>
    );
  }
});

export default GroupHeader;
