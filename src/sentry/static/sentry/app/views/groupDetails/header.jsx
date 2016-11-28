import React from 'react';
import {Link, browserHistory} from 'react-router';
import ApiMixin from '../../mixins/apiMixin';
import AssigneeSelector from '../../components/assigneeSelector';
import Count from '../../components/count';
import GroupActions from './actions';
import GroupSeenBy from './seenBy';
import IndicatorStore from '../../stores/indicatorStore';
import ListLink from '../../components/listLink';
import ShortId from '../../components/shortId';
import GroupTitle from '../../components/group/title';
import ProjectState from '../../mixins/projectState';
import {t} from '../../locale';

const GroupHeader = React.createClass({
  propTypes: {
    group: React.PropTypes.object.isRequired,
    memberList: React.PropTypes.array.isRequired
  },

  contextTypes: {
    location: React.PropTypes.object
  },

  mixins: [
    ApiMixin,
    ProjectState
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
        status: group.status === 'ignored' ? 'unresolved' : 'ignored'
      }
    }, {
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  onShare() {
    let {shareId} = this.props.group;
    return browserHistory.pushState(null, `/share/issue/${shareId}/`);
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

  getMessage() {
    let data = this.props.group;
    let metadata = data.metadata;
    switch (data.type) {
      case 'error':
        return metadata.value;
      case 'csp':
        return metadata.message;
      default:
        return this.props.group.culprit || '';
    }
  },

  render() {
    let group = this.props.group,
        orgFeatures = new Set(this.getOrganization().features),
        userCount = group.userCount;

    let className = 'group-detail';

    className += ' type-' + group.type;
    className += ' level-' + group.level;

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

    let message = this.getMessage();

    return (
      <div className={className}>
        <div className="row">
          <div className="col-sm-8">
            <h3>
              <GroupTitle data={group} />
            </h3>
            <div className="event-message">
              <span className="error-level">{group.level}</span>
              {message &&
                <span className="message">{message}</span>
              }
              {group.logger &&
                <span className="event-annotation">
                  <Link to={{
                      pathname:`/${orgId}/${projectId}/`,
                      query: {query: 'logger:' + group.logger}
                    }}>
                    {group.logger}
                  </Link>
                </span>
              }
              {group.annotations.map((annotation, i) => {
                return (
                  <span className="event-annotation" key={i}
                      dangerouslySetInnerHTML={{__html: annotation}} />
                );
              })}
            </div>
          </div>
          <div className="col-sm-4 stats">
            <div className="flex flex-justify-right">
              {group.shortId && this.getFeatures().has('callsigns') &&
                <div className="short-id-box count align-right">
                  <h6 className="nav-header">{t('Issue #')}</h6>
                  <ShortId shortId={group.shortId} />
                </div>
              }
              <div className="assigned-to">
                <h6 className="nav-header">{t('Assigned')}</h6>
                <AssigneeSelector id={group.id} />
              </div>
              <div className="count align-right">
                <h6 className="nav-header">{t('Events')}</h6>
                <Link to={`/${orgId}/${projectId}/issues/${groupId}/events/`}>
                  <Count className="count" value={group.count} />
                </Link>
              </div>
              <div className="count align-right">
                <h6 className="nav-header">{t('Users')}</h6>
                {userCount !== 0 ?
                  <Link to={`/${orgId}/${projectId}/issues/${groupId}/tags/user/`}>
                    <Count className="count" value={userCount} />
                  </Link>
                :
                  <span>0</span>
                }
              </div>
            </div>
          </div>
        </div>
        <GroupSeenBy />
        <GroupActions />
        {orgFeatures.has('shared-issues') &&
          <div className="pull-right">
            <div className="group-privacy">
              <a onClick={this.onShare}>
                <span className="icon" /> {t('Share this event')}
              </a>
            </div>
          </div>
        }
        <ul className="nav nav-tabs">
          <ListLink to={`/${orgId}/${projectId}/issues/${groupId}/`} isActive={() => {
            let rootGroupPath = `/${orgId}/${projectId}/issues/${groupId}/`;
            let pathname = this.context.location.pathname;

            // Because react-router 1.0 removes router.isActive(route)
            return pathname === rootGroupPath || /events\/\w+\/$/.test(pathname);
          }}>
            {t('Details')}
          </ListLink>
          <ListLink to={`/${orgId}/${projectId}/issues/${groupId}/activity/`}>
            {t('Comments')} <span className="badge animated">{group.numComments}</span>
          </ListLink>
          <ListLink to={`/${orgId}/${projectId}/issues/${groupId}/feedback/`}>
            {t('User Feedback')} <span className="badge animated">{group.userReportCount}</span>
          </ListLink>
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
