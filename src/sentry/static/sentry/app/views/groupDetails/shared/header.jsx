import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {Link} from 'react-router';
import ApiMixin from 'app/mixins/apiMixin';
import AssigneeSelector from 'app/components/assigneeSelector';
import Count from 'app/components/count';
import IndicatorStore from 'app/stores/indicatorStore';
import ListLink from 'app/components/listLink';
import NavTabs from 'app/components/navTabs';
import ShortId from 'app/components/shortId';
import EventOrGroupTitle from 'app/components/eventOrGroupTitle';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import OrganizationState from 'app/mixins/organizationState';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';

import GroupActions from './actions';
import GroupSeenBy from '../project/seenBy';

const GroupHeader = createReactClass({
  displayName: 'GroupHeader',

  propTypes: {
    group: SentryTypes.Group.isRequired,
    project: SentryTypes.Project,
  },

  contextTypes: {
    location: PropTypes.object,
    organization: SentryTypes.Organization,
  },

  mixins: [ApiMixin, OrganizationState],

  onToggleMute() {
    let group = this.props.group;
    let org = this.context.organization;
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));

    this.api.bulkUpdate(
      {
        orgId: org.slug,
        projectId: group.project.slug,
        itemIds: [group.id],
        data: {
          status: group.status === 'ignored' ? 'unresolved' : 'ignored',
        },
      },
      {
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        },
      }
    );
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
    let {project, group} = this.props;
    let projectFeatures = new Set(project ? project.features : []);
    let userCount = group.userCount;

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

    let groupId = group.id;
    let projectId = group.project.slug;
    let orgId = this.context.organization.slug;
    let message = this.getMessage();

    let hasSimilarView = projectFeatures.has('similarity-view');

    return (
      <div className={className}>
        <div className="row">
          <div className="col-sm-7">
            <h3>
              <EventOrGroupTitle data={group} />
            </h3>
            <div className="event-message">
              <span className="error-level">{group.level}</span>
              {message && <span className="message">{message}</span>}
              {group.logger && (
                <span className="event-annotation">
                  <Link
                    to={{
                      pathname: `/${orgId}/${projectId}/`,
                      query: {query: 'logger:' + group.logger},
                    }}
                  >
                    {group.logger}
                  </Link>
                </span>
              )}
              {group.annotations.map((annotation, i) => {
                return (
                  <span
                    className="event-annotation"
                    key={i}
                    dangerouslySetInnerHTML={{__html: annotation}}
                  />
                );
              })}
            </div>
          </div>
          <div className="col-sm-5 stats">
            <div className="flex flex-justify-right">
              {group.shortId && (
                <div className="short-id-box count align-right">
                  <h6 className="nav-header">
                    <GuideAnchor target="issue_number" type="text" />
                    <Tooltip
                      title={t(
                        'This identifier is unique across your organization, and can be used to reference an issue in various places, like commit messages.'
                      )}
                    >
                      <a
                        className="help-link"
                        href="https://docs.sentry.io/learn/releases/#resolving-issues-via-commits"
                      >
                        {t('Issue #')}
                      </a>
                    </Tooltip>
                  </h6>
                  <ShortId shortId={group.shortId} />
                </div>
              )}
              <div className="count align-right">
                <h6 className="nav-header">{t('Events')}</h6>
                <Link to={`/${orgId}/${projectId}/issues/${groupId}/events/`}>
                  <Count className="count" value={group.count} />
                </Link>
              </div>
              <div className="count align-right">
                <h6 className="nav-header">{t('Users')}</h6>
                {userCount !== 0 ? (
                  <Link to={`/${orgId}/${projectId}/issues/${groupId}/tags/user/`}>
                    <Count className="count" value={userCount} />
                  </Link>
                ) : (
                  <span>0</span>
                )}
              </div>
              <div className="assigned-to">
                <h6 className="nav-header">{t('Assignee')}</h6>
                <AssigneeSelector id={group.id} />
              </div>
            </div>
          </div>
        </div>
        <GroupSeenBy />
        <GroupActions group={group} project={project} />
        <NavTabs>
          <ListLink
            to={`/${orgId}/${projectId}/issues/${groupId}/`}
            isActive={() => {
              let rootGroupPath = `/${orgId}/${projectId}/issues/${groupId}/`;
              let pathname = this.context.location.pathname;

              // Because react-router 1.0 removes router.isActive(route)
              return pathname === rootGroupPath || /events\/\w+\/$/.test(pathname);
            }}
          >
            {t('Details')}
          </ListLink>
          <ListLink to={`/${orgId}/${projectId}/issues/${groupId}/activity/`}>
            {t('Comments')} <span className="badge animated">{group.numComments}</span>
          </ListLink>
          <ListLink to={`/${orgId}/${projectId}/issues/${groupId}/feedback/`}>
            {t('User Feedback')}{' '}
            <span className="badge animated">{group.userReportCount}</span>
          </ListLink>
          <ListLink to={`/${orgId}/${projectId}/issues/${groupId}/tags/`}>
            {t('Tags')}
          </ListLink>
          <ListLink to={`/${orgId}/${projectId}/issues/${groupId}/events/`}>
            {t('Events')}
          </ListLink>
          <ListLink to={`/${orgId}/${projectId}/issues/${groupId}/merged/`}>
            {t('Merged')}
          </ListLink>
          {hasSimilarView && (
            <ListLink to={`/${orgId}/${projectId}/issues/${groupId}/similar/`}>
              {t('Similar Issues')}
            </ListLink>
          )}
        </NavTabs>
      </div>
    );
  },
});

export default GroupHeader;
