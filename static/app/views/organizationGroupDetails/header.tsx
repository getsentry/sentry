import {Component, Fragment} from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
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
import IdBadge from 'sentry/components/idBadge';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
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
  replaysCount: number | null;
  event?: Event;
};

type MemberList = NonNullable<
  React.ComponentProps<typeof AssigneeSelector>['memberList']
>;

type State = {
  memberList?: MemberList;
};

class GroupHeader extends Component<Props, State> {
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
    const {
      project,
      group,
      currentTab,
      baseUrl,
      event,
      organization,
      location,
      replaysCount,
    } = this.props;
    const projectFeatures = new Set(project ? project.features : []);
    const organizationFeatures = new Set(organization ? organization.features : []);
    const userCount = group.userCount;

    const hasGroupingTreeUI = organizationFeatures.has('grouping-tree-ui');
    const hasSimilarView = projectFeatures.has('similarity-view');
    const hasEventAttachments = organizationFeatures.has('event-attachments');
    const hasIssueIdBreadcrumbs = organizationFeatures.has('issue-id-breadcrumbs');

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

    const shortIdBreadCrumb = group.shortId && (
      <GuideAnchor target="issue_number" position="bottom">
        <IssueBreadcrumbWrapper>
          <BreadcrumbProjectBadge
            project={project}
            avatarSize={16}
            hideName
            avatarProps={{hasTooltip: true, tooltip: project.slug}}
          />
          <StyledTooltip
            className="help-link"
            title={t(
              'This identifier is unique across your organization, and can be used to reference an issue in various places, like commit messages.'
            )}
            position="bottom"
          >
            <StyledShortId shortId={group.shortId} />
          </StyledTooltip>
        </IssueBreadcrumbWrapper>
      </GuideAnchor>
    );

    return (
      <Layout.Header>
        <div className={className}>
          <StyledBreadcrumbs
            crumbs={[
              {label: 'Issues', to: `/organizations/${orgId}/issues/${location.search}`},
              {
                label: hasIssueIdBreadcrumbs ? shortIdBreadCrumb : t('Issue Details'),
              },
            ]}
          />
          <div className="row">
            <div className="col-sm-7">
              <TitleWrapper>
                {!hasIssueIdBreadcrumbs && (
                  <StyledIdBadge
                    project={project}
                    avatarSize={24}
                    hideName
                    avatarProps={{hasTooltip: true, tooltip: project.slug}}
                  />
                )}
                <h3>
                  <EventOrGroupTitle hasGuideAnchor data={group} />
                </h3>
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
                    <Fragment>
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
                    </Fragment>
                  }
                />
              </StyledTagAndMessageWrapper>
            </div>

            {hasIssueIdBreadcrumbs ? (
              <StatsWrapper>
                <div className="count align-right m-l-1">
                  <h6 className="nav-header">{t('Events')}</h6>
                  {disableActions ? (
                    <Count className="count" value={group.count} />
                  ) : (
                    <Link to={eventRouteToObject}>
                      <Count className="count" value={group.count} />
                    </Link>
                  )}
                </div>
                <div className="count align-right m-l-1">
                  <h6 className="nav-header">{t('Users')}</h6>
                  {userCount !== 0 ? (
                    disableActions ? (
                      <Count className="count" value={userCount} />
                    ) : (
                      <Link to={`${baseUrl}tags/user/${location.search}`}>
                        <Count className="count" value={userCount} />
                      </Link>
                    )
                  ) : (
                    <span>0</span>
                  )}
                </div>
                <div className="assigned-to m-l-1">
                  <h6 className="nav-header">{t('Assignee')}</h6>
                  <AssigneeSelector
                    id={group.id}
                    memberList={memberList}
                    disabled={disableActions}
                  />
                </div>
              </StatsWrapper>
            ) : (
              <div className="col-sm-5 stats">
                <div className="flex flex-justify-right">
                  {group.shortId && (
                    <GuideAnchor target="issue_number" position="bottom">
                      <div className="short-id-box count align-right">
                        <h6 className="nav-header">
                          <Tooltip
                            className="help-link"
                            showUnderline
                            title={t(
                              'This identifier is unique across your organization, and can be used to reference an issue in various places, like commit messages.'
                            )}
                            position="bottom"
                          >
                            <ExternalLink href="https://docs.sentry.io/product/integrations/source-code-mgmt/github/#resolve-via-commit-or-pull-request">
                              {t('Issue #')}
                            </ExternalLink>
                          </Tooltip>
                        </h6>
                        <ShortId
                          shortId={group.shortId}
                          avatar={
                            <StyledProjectBadge
                              project={project}
                              avatarSize={20}
                              hideName
                            />
                          }
                        />
                      </div>
                    </GuideAnchor>
                  )}
                  <div className="count align-right m-l-1">
                    <h6 className="nav-header">{t('Events')}</h6>
                    {disableActions ? (
                      <Count className="count" value={group.count} />
                    ) : (
                      <Link to={eventRouteToObject}>
                        <Count className="count" value={group.count} />
                      </Link>
                    )}
                  </div>
                  <div className="count align-right m-l-1">
                    <h6 className="nav-header">{t('Users')}</h6>
                    {userCount !== 0 ? (
                      disableActions ? (
                        <Count className="count" value={userCount} />
                      ) : (
                        <Link to={`${baseUrl}tags/user/${location.search}`}>
                          <Count className="count" value={userCount} />
                        </Link>
                      )
                    ) : (
                      <span>0</span>
                    )}
                  </div>
                  <div className="assigned-to m-l-1">
                    <h6 className="nav-header">{t('Assignee')}</h6>
                    <AssigneeSelector
                      id={group.id}
                      memberList={memberList}
                      disabled={disableActions}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <SeenByList
            seenBy={group.seenBy}
            iconTooltip={t('People who have viewed this issue')}
          />
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
            <Feature features={['session-replay']} organization={organization}>
              <ListLink
                to={`${baseUrl}replays/${location.search}`}
                isActive={() => currentTab === Tab.REPLAYS}
              >
                {t('Replays')} <Badge text={replaysCount ?? ''} />
              </ListLink>
            </Feature>
          </NavTabs>
        </div>
      </Layout.Header>
    );
  }
}

export default withApi(withRouter(withOrganization(GroupHeader)));

const TitleWrapper = styled('div')`
  display: flex;
  line-height: 24px;
`;

const StyledBreadcrumbs = styled(Breadcrumbs)`
  margin-bottom: ${space(2)};
`;

const IssueBreadcrumbWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledIdBadge = styled(IdBadge)`
  margin-right: ${space(1)};
`;

const StyledTooltip = styled(Tooltip)`
  display: flex;
`;

const StyledShortId = styled(ShortId)`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StatsWrapper = styled('div')`
  display: grid;
  justify-content: flex-end;
  grid-template-columns: repeat(3, min-content);
  gap: ${space(3)};
  margin-right: 15px;
`;

const InboxReasonWrapper = styled('div')`
  margin-left: ${space(1)};
`;

const StyledTagAndMessageWrapper = styled(TagAndMessageWrapper)`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  justify-content: flex-start;
  line-height: 1.2;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
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

const BreadcrumbProjectBadge = styled(StyledProjectBadge)`
  margin-right: ${space(0.75)};
`;

const EventAnnotationWithSpace = styled(EventAnnotation)`
  margin-left: ${space(1)};
`;
