import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {Link} from 'react-router';
import ApiMixin from 'app/mixins/apiMixin';
import {fetchProjectMembers} from 'app/actionCreators/members';
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
import GroupSeenBy from './seenBy';

const GroupHeader = createReactClass({
  displayName: 'GroupHeader',

  propTypes: {
    group: SentryTypes.Group.isRequired,
    project: SentryTypes.Project,
    params: PropTypes.object,
  },

  contextTypes: {
    location: PropTypes.object,
    organization: SentryTypes.Organization,
  },

  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    return {memberList: null};
  },

  componentDidMount() {
    const {organization} = this.context;
    const {group} = this.props;
    fetchProjectMembers(
      this.api,
      organization.slug,
      group.project.slug
    ).then(memberList => this.setState({memberList}));
  },

  onToggleMute() {
    const group = this.props.group;
    const org = this.context.organization;
    const loadingIndicator = IndicatorStore.add(t('Saving changes..'));

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
    const data = this.props.group;
    const metadata = data.metadata;
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
    const {project, group, params} = this.props;
    const projectFeatures = new Set(project ? project.features : []);
    const userCount = group.userCount;

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

    const {memberList} = this.state;
    const groupId = group.id;
    const orgId = this.context.organization.slug;
    const message = this.getMessage();

    const hasSimilarView = projectFeatures.has('similarity-view');

    const baseUrl = params.projectId
      ? `/${orgId}/${params.projectId}/issues/`
      : `/organizations/${orgId}/issues/`;

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
                      pathname: baseUrl,
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
                      tooltipOptions={{placement: 'bottom'}}
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
              <div className="count align-right m-l-1">
                <h6 className="nav-header">{t('Events')}</h6>
                <Link to={`${baseUrl}${groupId}/events/`}>
                  <Count className="count" value={group.count} />
                </Link>
              </div>
              <div className="count align-right m-l-1">
                <h6 className="nav-header">{t('Users')}</h6>
                {userCount !== 0 ? (
                  <Link to={`${baseUrl}${groupId}/tags/user/`}>
                    <Count className="count" value={userCount} />
                  </Link>
                ) : (
                  <span>0</span>
                )}
              </div>
              <div className="assigned-to m-l-1">
                <h6 className="nav-header">{t('Assignee')}</h6>
                <AssigneeSelector id={group.id} memberList={memberList} />
              </div>
            </div>
          </div>
        </div>
        <GroupSeenBy group={group} />
        <GroupActions group={group} project={project} />
        <NavTabs>
          <ListLink
            to={`${baseUrl}${groupId}/`}
            isActive={() => {
              const rootGroupPath = `${baseUrl}${groupId}/`;
              const pathname = this.context.location.pathname;

              // Because react-router 1.0 removes router.isActive(route)
              return pathname === rootGroupPath || /events\/\w+\/$/.test(pathname);
            }}
          >
            {t('Details')}
          </ListLink>
          <ListLink to={`${baseUrl}${groupId}/activity/`}>
            {t('Comments')} <span className="badge animated">{group.numComments}</span>
          </ListLink>
          <ListLink to={`${baseUrl}${groupId}/feedback/`}>
            {t('User Feedback')}{' '}
            <span className="badge animated">{group.userReportCount}</span>
          </ListLink>
          <ListLink to={`${baseUrl}${groupId}/tags/`}>{t('Tags')}</ListLink>
          <ListLink to={`${baseUrl}${groupId}/events/`}>{t('Events')}</ListLink>
          <ListLink to={`${baseUrl}${groupId}/merged/`}>{t('Merged')}</ListLink>
          {hasSimilarView && (
            <ListLink to={`${baseUrl}${groupId}/similar/`}>
              {t('Similar Issues')}
            </ListLink>
          )}
        </NavTabs>
      </div>
    );
  },
});

export default GroupHeader;
