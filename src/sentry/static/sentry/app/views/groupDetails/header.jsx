import React from 'react';
// import Router from "react-router";
import {Link, History} from 'react-router';
import ApiMixin from '../../mixins/apiMixin';
import AssigneeSelector from '../../components/assigneeSelector';
import Count from '../../components/count';
import GroupActions from './actions';
import GroupSeenBy from './seenBy';
import IndicatorStore from '../../stores/indicatorStore';
import ListLink from '../../components/listLink';
import ProjectState from '../../mixins/projectState';
import {t} from '../../locale';

const GroupHeader = React.createClass({
  propTypes: {
    memberList: React.PropTypes.instanceOf(Array).isRequired
  },

  contextTypes: {
    location: React.PropTypes.object
  },

  mixins: [
    ApiMixin,
    ProjectState,
    History
  ],

  onToggleMute() {
    let group = this.props.group;
    let project = this.getProject();
    let org = this.getOrganization();
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));

    this.api.bulkUpdate({
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
    return this.history.pushState(null, `/share/issue/${shareId}/`);
  },

  onTogglePublic() {
    let group = this.props.group;
    let project = this.getProject();
    let org = this.getOrganization();
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));

    this.api.bulkUpdate({
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
    let group = this.props.group,
        userCount = group.userCount,
        features = this.getProjectFeatures();

    let className = 'group-detail level-' + group.level;
    if (group.isBookmarked) {
      className += ' isBookmarked';
    }
    if (group.hasSeen) {
      className += ' hasSeen';
    }
    if (group.status === 'resolved') {
      className += ' isResolved';
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
                  <Link to={`/${orgId}/${projectId}/`} query={{query: 'logger:' + group.logger}}>
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
                <h6 className="nav-header">{t('Assigned')}</h6>
                <AssigneeSelector id={group.id} />
              </div>
              <div className="col-xs-4 count align-right">
                <h6 className="nav-header">{t('Events')}</h6>
                <Link to={`/${orgId}/${projectId}/issues/${groupId}/events/`}>
                  <Count className="count" value={group.count} />
                </Link>
              </div>
              <div className="col-xs-4 count align-right">
                <h6 className="nav-header">{t('Users')}</h6>
                {userCount !== 0 ?
                  <Link to={`/${orgId}/${projectId}/issues/${groupId}/tags/user/`}>
                    <Count className="count" value={userCount} />
                  </Link>
                :
                  0
                }
              </div>
            </div>
          </div>
        </div>
        <GroupSeenBy />
        <GroupActions />
        <div className="pull-right">
          <div className="group-privacy">
            <a onClick={this.onShare}>
              <span className="icon" /> {t('Share this event')}
            </a>
          </div>
        </div>
        <ul className="nav nav-tabs">
          <ListLink to={`/${orgId}/${projectId}/issues/${groupId}/`} isActive={function (to) {
            let rootGroupPath = `/${orgId}/${projectId}/issues/${groupId}/`;
            let pathname = this.context.location.pathname;

            // Because react-router 1.0 removes router.isActive(route)
            return pathname === rootGroupPath || /events\/\w+\/$/.test(pathname);
          }.bind(this)}>
            {t('Details')}
          </ListLink>
          <ListLink to={`/${orgId}/${projectId}/issues/${groupId}/activity/`}>
            {t('Comments')} <span className="badge animated">{group.numComments}</span>
          </ListLink>
          {features.has('user-reports') &&
            <ListLink to={`/${orgId}/${projectId}/issues/${groupId}/reports/`}>
              {t('User Reports')} <span className="badge animated">{group.userReportCount}</span>
            </ListLink>
          }
          <ListLink to={`/${orgId}/${projectId}/issues/${groupId}/tags/`}>
            {t('Tags')}
          </ListLink>
          <ListLink to={`/${orgId}/${projectId}/issues/${groupId}/events/`}>
            {t('Related Events')}
          </ListLink>
        </ul>
      </div>
    );
  }
});

export default GroupHeader;
