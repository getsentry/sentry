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
import ProjectBadge from 'app/components/idBadge/projectBadge';
import SeenByList from 'app/components/seenByList';
import SentryTypes from 'app/sentryTypes';
import ShortId from 'app/components/shortId';
import Tooltip from 'app/components/tooltip';
import Badge from 'app/components/badge';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import overflowEllipsisLeft from 'app/styles/overflowEllipsisLeft';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import {getMessage} from 'app/utils/events';
import * as Layout from 'app/components/layouts/thirds';

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

  render() {
    const {project, group, currentTab, baseUrl} = this.props;
    const {organization, location} = this.context;
    const projectFeatures = new Set(project ? project.features : []);
    const organizationFeatures = new Set(organization ? organization.features : []);
    const userCount = group.userCount;

    let className = '';

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
      <Wrapper className={className}>
        <Header>
          <HeaderContent>
            <GroupTitleWrapper>
              <EventOrGroupTitle hasGuideAnchor data={group} />
            </GroupTitleWrapper>

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
          </HeaderContent>

          <HeaderActions>
            <HeaderDetails>
              {group.shortId && (
                <GuideAnchor target="issue_number" position="bottom">
                  <ShortIdBox>
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
                    <StyledShortId
                      shortId={group.shortId}
                      avatar={
                        <StyledProjectBadge project={project} avatarSize={20} hideName />
                      }
                    />
                  </ShortIdBox>
                </GuideAnchor>
              )}
              <div>
                <h6 className="nav-header">{t('Events')}</h6>
                <Link to={eventRouteToObject}>
                  <HeaderDetailsCount value={group.count} />
                </Link>
              </div>
              <div>
                <h6 className="nav-header">{t('Users')}</h6>
                {userCount !== 0 ? (
                  <Link to={`${baseUrl}tags/user/${location.search}`}>
                    <HeaderDetailsCount value={userCount} />
                  </Link>
                ) : (
                  <span>0</span>
                )}
              </div>
              <div>
                <h6 className="nav-header">{t('Assignee')}</h6>
                <AssigneeSelector id={group.id} memberList={memberList} />
              </div>
            </HeaderDetails>
          </HeaderActions>
        </Header>

        <Header>
          <SeenByList
            seenBy={group.seenBy}
            iconTooltip={t('People who have viewed this issue')}
          />
          <GroupActions group={group} project={project} />
        </Header>

        <TabLayoutHeader>
          <Layout.HeaderNavTabs underlined>
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
          </Layout.HeaderNavTabs>
        </TabLayoutHeader>
      </Wrapper>
    );
  }
}

const GroupTitleWrapper = styled('h3')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.headerFontSize};
  margin: 0 0 ${space(1)};
  ${overflowEllipsis}
`;

const Wrapper = styled('div')`
  background-color: ${p => p.theme.backgroundSecondary};
`;

const HeaderContent = styled(Layout.HeaderContent)`
  margin-right: ${space(1)};
  margin-bottom: 0;
`;

const Header = styled(Layout.Header)`
  flex-wrap: nowrap;
  border-bottom: 0;
`;

const HeaderActions = styled(Layout.HeaderActions)`
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    margin-bottom: 0;
    width: auto;
  }
`;

const HeaderDetails = styled('div')`
  display: grid;
  font-size: ${p => p.theme.fontSizeExtraLarge};
  gap: ${space(2)};
  grid-auto-flow: column;
  text-align: right;
  max-width: 400px;

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    max-width: none;
  }
`;

const HeaderDetailsCount = styled(Count)`
  font-size: ${p => p.theme.headerFontSize};
`;

const TabLayoutHeader = styled(Layout.Header)``;

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

const ShortIdBox = styled('div')`
  overflow: hidden; /* needed for ellipsis when ShortId is too long */
`;

const StyledShortId = styled(ShortId)`
  .auto-select-text > span {
    ${overflowEllipsisLeft};
  }
`;

export {GroupHeader, TAB};

export default withApi(GroupHeader);
