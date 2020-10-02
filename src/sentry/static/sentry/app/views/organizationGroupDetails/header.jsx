import {Link} from 'react-router';
import omit from 'lodash/omit';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {fetchOrgMembers} from 'app/actionCreators/members';
import {t} from 'app/locale';
import AssigneeSelector from 'app/components/assigneeSelector';
import Count from 'app/components/count';
import EventAnnotation from 'app/components/events/eventAnnotation';
import EventMessage from 'app/components/events/eventMessage';
import EventOrGroupTitle from 'app/components/eventOrGroupTitle';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import SeenByList from 'app/components/seenByList';
import SentryTypes from 'app/sentryTypes';
import ShortId from 'app/components/shortId';
import Tooltip from 'app/components/tooltip';
import Badge from 'app/components/badge';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

import GroupActions from './actions';
import UnhandledTag, {TagAndMessageWrapper} from './unhandledTag';

const TAB = {
  DETAILS: 'details',
  COMMENTS: 'comments',
  USER_FEEDBACK: 'user-feedback',
  ATTACHMENTS: 'attachments',
  TAGS: 'tags',
  EVENTS: 'events',
  MERGED: 'merged',
  SIMILAR_ISSUES: 'similar-issues',
};

class GroupHeader extends React.Component {
  static propTypes = {
    currentTab: PropTypes.string.isRequired,
    baseUrl: PropTypes.string.isRequired,
    group: SentryTypes.Group.isRequired,
    project: SentryTypes.Project,
    api: PropTypes.object,
  };

  static contextTypes = {
    location: PropTypes.object,
    organization: SentryTypes.Organization,
  };

  state = {memberList: null};

  componentDidMount() {
    const {organization} = this.context;
    const {project} = this.props.group;

    fetchOrgMembers(this.props.api, organization.slug, project.id).then(memberList => {
      const users = memberList.map(member => member.user);
      this.setState({memberList: users});
    });
  }

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
  }

  render() {
    const {project, group, currentTab, baseUrl} = this.props;
    const {organization, location} = this.context;
    const projectFeatures = new Set(project ? project.features : []);
    const organizationFeatures = new Set(organization ? organization.features : []);
    const userCount = group.userCount;

    let className = 'group-detail';

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
    const orgId = organization.slug;
    const message = this.getMessage();

    const hasSimilarView = projectFeatures.has('similarity-view');
    const hasEventAttachments = organizationFeatures.has('event-attachments');

    const searchTermWithoutQuery = omit(location.query, 'query');
    const eventRouteToObject = {
      pathname: `${baseUrl}events/`,
      query: searchTermWithoutQuery,
    };

    return (
      <div className={className}>
        <div className="row">
          <div className="col-sm-7">
            <h3>
              <EventOrGroupTitle hasGuideAnchor data={group} />
            </h3>
            <StyledTagAndMessageWrapper>
              {group.isUnhandled && <UnhandledTag />}
              <EventMessage
                message={message}
                level={group.level}
                annotations={
                  <React.Fragment>
                    {group.logger && (
                      <EventAnnotationWithSpace>
                        <Link
                          to={{
                            pathname: `/organizations/${orgId}/issues/`,
                            query: {query: 'logger:' + group.logger},
                          }}
                        >
                          {group.logger}
                        </Link>
                      </EventAnnotationWithSpace>
                    )}
                    {group.annotations.map((annotation, i) => (
                      <EventAnnotationWithSpace
                        key={i}
                        dangerouslySetInnerHTML={{__html: annotation}}
                      />
                    ))}
                  </React.Fragment>
                }
              />
            </StyledTagAndMessageWrapper>
          </div>

          <div className="col-sm-5 stats">
            <div className="flex flex-justify-right">
              {group.shortId && (
                <GuideAnchor target="issue_number" position="bottom">
                  <div className="short-id-box count align-right">
                    <h6 className="nav-header">
                      <Tooltip
                        title={t(
                          'This identifier is unique across your organization, and can be used to reference an issue in various places, like commit messages.'
                        )}
                        position="bottom"
                      >
                        <a
                          className="help-link"
                          href="https://docs.sentry.io/learn/releases/#resolving-issues-via-commits"
                        >
                          {t('Issue #')}
                        </a>
                      </Tooltip>
                    </h6>
                    <ShortId
                      shortId={group.shortId}
                      avatar={
                        <StyledProjectBadge project={project} avatarSize={20} hideName />
                      }
                    />
                  </div>
                </GuideAnchor>
              )}
              <div className="count align-right m-l-1">
                <h6 className="nav-header">{t('Events')}</h6>
                <Link to={eventRouteToObject}>
                  <Count className="count" value={group.count} />
                </Link>
              </div>
              <div className="count align-right m-l-1">
                <h6 className="nav-header">{t('Users')}</h6>
                {userCount !== 0 ? (
                  <Link to={`${baseUrl}tags/user/${location.search}`}>
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
        <SeenByList
          seenBy={group.seenBy}
          iconTooltip={t('People who have viewed this issue')}
        />
        <GroupActions group={group} project={project} />
        <NavTabs>
          <ListLink
            to={`${baseUrl}${location.search}`}
            isActive={() => currentTab === TAB.DETAILS}
          >
            {t('Details')}
          </ListLink>
          <ListLink
            to={`${baseUrl}activity/${location.search}`}
            isActive={() => currentTab === TAB.COMMENTS}
          >
            {t('Activity')} <Badge text={group.numComments} />
          </ListLink>
          <ListLink
            to={`${baseUrl}feedback/${location.search}`}
            isActive={() => currentTab === TAB.USER_FEEDBACK}
          >
            {t('User Feedback')} <Badge text={group.userReportCount} />
          </ListLink>
          {hasEventAttachments && (
            <ListLink
              to={`${baseUrl}attachments/${location.search}`}
              isActive={() => currentTab === TAB.ATTACHMENTS}
            >
              {t('Attachments')}
            </ListLink>
          )}
          <ListLink
            to={`${baseUrl}tags/${location.search}`}
            isActive={() => currentTab === TAB.TAGS}
          >
            {t('Tags')}
          </ListLink>
          <ListLink to={eventRouteToObject} isActive={() => currentTab === 'events'}>
            {t('Events')}
          </ListLink>
          <ListLink
            to={`${baseUrl}merged/${location.search}`}
            isActive={() => currentTab === TAB.MERGED}
          >
            {t('Merged')}
          </ListLink>
          {hasSimilarView && (
            <ListLink
              to={`${baseUrl}similar/${location.search}`}
              isActive={() => currentTab === TAB.SIMILAR_ISSUES}
            >
              {t('Similar Issues')}
            </ListLink>
          )}
        </NavTabs>
      </div>
    );
  }
}

const StyledTagAndMessageWrapper = styled(TagAndMessageWrapper)`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    margin-bottom: ${space(2)};
  }
`;

const StyledProjectBadge = styled(ProjectBadge)`
  flex-shrink: 0;
`;

const EventAnnotationWithSpace = styled(EventAnnotation)`
  margin-left: ${space(1)};
`;

export {GroupHeader, TAB};

export default withApi(GroupHeader);
