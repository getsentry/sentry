import React from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import PropTypes from 'prop-types';

import {fetchOrgMembers} from 'app/actionCreators/members';
import {Client} from 'app/api';
import AssigneeSelector from 'app/components/assigneeSelector';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import Badge from 'app/components/badge';
import Count from 'app/components/count';
import EventOrGroupTitle from 'app/components/eventOrGroupTitle';
import EventAnnotation from 'app/components/events/eventAnnotation';
import EventMessage from 'app/components/events/eventMessage';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import ExternalLink from 'app/components/links/externalLink';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import SeenByList from 'app/components/seenByList';
import ShortId from 'app/components/shortId';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import {Group, Project} from 'app/types';
import {getMessage} from 'app/utils/events';
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

type Props = {
  currentTab: string;
  baseUrl: string;
  group: Group;
  project: Project;
  api: Client;
};

type MemberList = NonNullable<
  React.ComponentProps<typeof AssigneeSelector>['memberList']
>;

type State = {
  memberList?: MemberList;
};

class GroupHeader extends React.Component<Props, State> {
  static contextTypes = {
    location: PropTypes.object,
    organization: SentryTypes.Organization,
  };

  state: State = {};

  componentDidMount() {
    const {organization} = this.context;
    const {group, api} = this.props;
    const {project} = group;

    fetchOrgMembers(api, organization.slug, [project.id]).then(memberList => {
      const users = memberList.map(member => member.user);
      this.setState({memberList: users});
    });
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
    const message = getMessage(group);

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
                        className="help-link"
                        title={t(
                          'This identifier is unique across your organization, and can be used to reference an issue in various places, like commit messages.'
                        )}
                        position="bottom"
                      >
                        <ExternalLink href="https://docs.sentry.io/learn/releases/#resolving-issues-via-commits">
                          {t('Issue #')}
                        </ExternalLink>
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
            {t('Merged Issues')}
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
