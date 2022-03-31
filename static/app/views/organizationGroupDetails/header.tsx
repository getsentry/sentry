import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {Client} from 'sentry/api';
import AssigneeSelector from 'sentry/components/assigneeSelector';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Badge from 'sentry/components/badge';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import Count from 'sentry/components/count';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import ErrorLevel from 'sentry/components/events/errorLevel';
import EventAnnotation from 'sentry/components/events/eventAnnotation';
import EventMessage from 'sentry/components/events/eventMessage';
import InboxReason from 'sentry/components/group/inboxBadges/inboxReason';
import UnhandledInboxTag from 'sentry/components/group/inboxBadges/unhandledTag';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import ListLink from 'sentry/components/links/listLink';
import NavTabs from 'sentry/components/navTabs';
import SeenByList from 'sentry/components/seenByList';
import ShortId from 'sentry/components/shortId';
import Tooltip from 'sentry/components/tooltip';
import {IconChat} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Group, Organization, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {getMessage} from 'sentry/utils/events';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

import GroupActions from './actions';
import {Tab} from './types';
import {TagAndMessageWrapper} from './unhandledTag';
import {ReprocessingStatus} from './utils';

type Props = WithRouterProps & {
  api: Client;
  baseUrl: string;
  currentTab: string;
  group: Group;
  groupReprocessingStatus: ReprocessingStatus;
  organization: Organization;
  project: Project;
  event?: Event;
};

type MemberList = NonNullable<
  React.ComponentProps<typeof AssigneeSelector>['memberList']
>;

type State = {
  memberList?: MemberList;
};

class GroupHeader extends React.Component<Props, State> {
  state: State = {};

  componentDidMount() {
    const {group, api, organization} = this.props;
    const {project} = group;

    fetchOrgMembers(api, organization.slug, [project.id]).then(memberList => {
      const users = memberList.map(member => member.user);
      this.setState({memberList: users});
    });
  }

  getDisabledTabs() {
    const {organization} = this.props;

    const hasReprocessingV2Feature = organization.features.includes('reprocessing-v2');

    if (!hasReprocessingV2Feature) {
      return [];
    }

    const {groupReprocessingStatus} = this.props;

    if (groupReprocessingStatus === ReprocessingStatus.REPROCESSING) {
      return [
        Tab.ACTIVITY,
        Tab.USER_FEEDBACK,
        Tab.ATTACHMENTS,
        Tab.EVENTS,
        Tab.MERGED,
        Tab.GROUPING,
        Tab.SIMILAR_ISSUES,
        Tab.TAGS,
      ];
    }

    if (groupReprocessingStatus === ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT) {
      return [
        Tab.DETAILS,
        Tab.ATTACHMENTS,
        Tab.EVENTS,
        Tab.MERGED,
        Tab.GROUPING,
        Tab.SIMILAR_ISSUES,
        Tab.TAGS,
        Tab.USER_FEEDBACK,
      ];
    }

    return [];
  }

  render() {
    const {project, group, currentTab, baseUrl, event, organization, location} =
      this.props;
    const projectFeatures = new Set(project ? project.features : []);
    const organizationFeatures = new Set(organization ? organization.features : []);
    const userCount = group.userCount;

    const hasGroupingTreeUI = organizationFeatures.has('grouping-tree-ui');
    const hasSimilarView = projectFeatures.has('similarity-view');
    const hasEventAttachments = organizationFeatures.has('event-attachments');

    let className = 'group-detail';

    if (group.hasSeen) {
      className += ' hasSeen';
    }

    if (group.status === 'resolved') {
      className += ' isResolved';
    }

    const {memberList} = this.state;
    const orgId = organization.slug;
    const message = getMessage(group);

    const searchTermWithoutQuery = omit(location.query, 'query');
    const eventRouteToObject = {
      pathname: `${baseUrl}events/`,
      query: searchTermWithoutQuery,
    };

    const disabledTabs = this.getDisabledTabs();
    const disableActions = !!disabledTabs.length;

    return (
      <Layout.Header>
        <StyledHeaderContent>
          <Breadcrumbs
            crumbs={[
              {label: t('Issues'), to: `/organizations/${orgId}/issues/`},
              {
                label: (
                  <React.Fragment>
                    {group.shortId && (
                      <GuideAnchor target="issue_number" position="bottom">
                        <Tooltip
                          className="help-link"
                          title={t(
                            'This is the issue ID which can be referenced in various places, like commit messages.'
                          )}
                          position="bottom"
                        >
                          <StyledShortId
                            shortId={group.shortId}
                            avatar={
                              <StyledProjectBadge
                                project={project}
                                avatarSize={20}
                                hideName
                              />
                            }
                          />
                        </Tooltip>
                      </GuideAnchor>
                    )}
                  </React.Fragment>
                ),
                to: null,
              },
            ]}
          />
          <div className={className}>
            <HeaderSummaryWrapper>
              <IssueDescription>
                <TitleWrapper>
                  <Layout.Title>
                    <EventOrGroupTitle hasGuideAnchor data={group} />
                  </Layout.Title>
                  {group.inbox && (
                    <InboxReasonWrapper>
                      <InboxReason inbox={group.inbox} fontSize="md" />
                    </InboxReasonWrapper>
                  )}
                </TitleWrapper>
                <StyledTagAndMessageWrapper>
                  {group.level && <ErrorLevel level={group.level} size="11px" />}
                  {group.isUnhandled && <UnhandledInboxTag />}
                  <EventMessage
                    message={message}
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
              </IssueDescription>

              <SummaryStats>
                <div>
                  <h6 className="nav-header">{t('Events')}</h6>
                  {disableActions ? (
                    <CountWrapper>
                      <Count value={group.count} />
                    </CountWrapper>
                  ) : (
                    <Link to={eventRouteToObject}>
                      <CountWrapper>
                        <Count value={group.count} />
                      </CountWrapper>
                    </Link>
                  )}
                </div>
                <div>
                  <h6 className="nav-header">{t('Users')}</h6>
                  {userCount !== 0 ? (
                    disableActions ? (
                      <CountWrapper>
                        <Count value={userCount} />
                      </CountWrapper>
                    ) : (
                      <Link to={`${baseUrl}tags/user/${location.search}`}>
                        <CountWrapper>
                          <Count value={userCount} />
                        </CountWrapper>
                      </Link>
                    )
                  ) : (
                    <span>0</span>
                  )}
                </div>
                <AssigneeWrapper>
                  <h6 className="nav-header">{t('Assignee')}</h6>
                  <AssigneeSelector
                    id={group.id}
                    memberList={memberList}
                    disabled={disableActions}
                  />
                </AssigneeWrapper>
              </SummaryStats>
            </HeaderSummaryWrapper>
            <SeenByListWrapper>
              <SeenByList
                seenBy={group.seenBy}
                iconTooltip={t('People who have viewed this issue')}
              />
            </SeenByListWrapper>
            <GroupActions
              group={group}
              project={project}
              disabled={disableActions}
              event={event}
              query={location.query}
            />
            <NavTabs>
              <ListLink
                to={`${baseUrl}${location.search}`}
                isActive={() => currentTab === Tab.DETAILS}
                disabled={disabledTabs.includes(Tab.DETAILS)}
              >
                {t('Details')}
              </ListLink>
              <StyledListLink
                to={`${baseUrl}activity/${location.search}`}
                isActive={() => currentTab === Tab.ACTIVITY}
                disabled={disabledTabs.includes(Tab.ACTIVITY)}
              >
                {t('Activity')}
                <Badge>
                  {group.numComments}
                  <IconChat size="xs" />
                </Badge>
              </StyledListLink>
              <StyledListLink
                to={`${baseUrl}feedback/${location.search}`}
                isActive={() => currentTab === Tab.USER_FEEDBACK}
                disabled={disabledTabs.includes(Tab.USER_FEEDBACK)}
              >
                {t('User Feedback')} <Badge text={group.userReportCount} />
              </StyledListLink>
              {hasEventAttachments && (
                <ListLink
                  to={`${baseUrl}attachments/${location.search}`}
                  isActive={() => currentTab === Tab.ATTACHMENTS}
                  disabled={disabledTabs.includes(Tab.ATTACHMENTS)}
                >
                  {t('Attachments')}
                </ListLink>
              )}
              <ListLink
                to={`${baseUrl}tags/${location.search}`}
                isActive={() => currentTab === Tab.TAGS}
                disabled={disabledTabs.includes(Tab.TAGS)}
              >
                {t('Tags')}
              </ListLink>
              <ListLink
                to={eventRouteToObject}
                isActive={() => currentTab === Tab.EVENTS}
                disabled={disabledTabs.includes(Tab.EVENTS)}
              >
                {t('Events')}
              </ListLink>
              <ListLink
                to={`${baseUrl}merged/${location.search}`}
                isActive={() => currentTab === Tab.MERGED}
                disabled={disabledTabs.includes(Tab.MERGED)}
              >
                {t('Merged Issues')}
              </ListLink>
              {hasGroupingTreeUI && (
                <ListLink
                  to={`${baseUrl}grouping/${location.search}`}
                  isActive={() => currentTab === Tab.GROUPING}
                  disabled={disabledTabs.includes(Tab.GROUPING)}
                >
                  {t('Grouping')}
                </ListLink>
              )}
              {hasSimilarView && (
                <ListLink
                  to={`${baseUrl}similar/${location.search}`}
                  isActive={() => currentTab === Tab.SIMILAR_ISSUES}
                  disabled={disabledTabs.includes(Tab.SIMILAR_ISSUES)}
                >
                  {t('Similar Issues')}
                </ListLink>
              )}
            </NavTabs>
          </div>
        </StyledHeaderContent>
      </Layout.Header>
    );
  }
}

export {GroupHeader};

export default withApi(withRouter(withOrganization(GroupHeader)));

const StyledHeaderContent = styled(Layout.HeaderContent)`
  margin-bottom: 0 !important;
`;

const IssueDescription = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    max-width: 70%;
  }
  @media (min-width: ${p => p.theme.breakpoints[4]}) {
    max-width: 85%;
  }
`;

const TitleWrapper = styled('div')`
  display: flex;
  margin-bottom: ${space(0.5)};
`;

const StyledShortId = styled(ShortId)`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const HeaderSummaryWrapper = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: flex;
    justify-content: space-between;
    gap: ${space(4)};
  }
`;

const SummaryStats = styled('div')`
  display: flex;
  gap: ${space(4)};
  margin-top: ${space(3)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    margin-top: ${space(1)};
    justify-items: flex-end;
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    margin-top: ${space(3)};
  }
`;

const CountWrapper = styled('div')`
  span:not(.help-link) {
    font-size: ${p => p.theme.headerFontSize};
    line-height: 1;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;

    @media (min-width: ${p => p.theme.breakpoints[1]}) {
      text-align: right;
    }
  }
`;

const AssigneeWrapper = styled('div')`
  position: relative;
`;

const InboxReasonWrapper = styled('div')`
  margin-left: ${space(1)};
  align-self: flex-end;
  margin-bottom: ${space(0.5)};
`;

const SeenByListWrapper = styled('div')`
  display: none;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: block;
  }
`;

const StyledTagAndMessageWrapper = styled(TagAndMessageWrapper)`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  justify-content: flex-start;
  line-height: 1.2;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    margin-bottom: ${space(2)};
  }
`;

const StyledListLink = styled(ListLink)`
  svg {
    margin-left: ${space(0.5)};
    margin-bottom: ${space(0.25)};
    vertical-align: middle;
  }
`;

const StyledProjectBadge = styled(ProjectBadge)`
  flex-shrink: 0;
`;

const EventAnnotationWithSpace = styled(EventAnnotation)`
  margin-left: ${space(1)};
`;
