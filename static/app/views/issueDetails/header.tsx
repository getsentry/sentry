import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';
import omit from 'lodash/omit';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Badge} from 'sentry/components/core/badge';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import Count from 'sentry/components/count';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventMessage from 'sentry/components/events/eventMessage';
import {GroupStatusBadge} from 'sentry/components/group/inboxBadges/statusBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import ReplayCountBadge from 'sentry/components/replays/replayCountBadge';
import {TabList} from 'sentry/components/tabs';
import {IconChat} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {IssueCategory, IssueType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import useReplayCountForIssues from 'sentry/utils/replayCount/useReplayCountForIssues';
import {projectCanLinkToReplay} from 'sentry/utils/replays/projectSupportsReplay';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import GroupPriority from 'sentry/views/issueDetails/groupPriority';
import {useIssueDetailsHeader} from 'sentry/views/issueDetails/useIssueDetailsHeader';

import {GroupActions} from './actions';
import {Tab, TabPaths} from './types';
import {getGroupReprocessingStatus} from './utils';

type Props = {
  baseUrl: string;
  event: Event | null;
  group: Group;
  organization: Organization;
  project: Project;
};

interface GroupHeaderTabsProps extends Pick<Props, 'baseUrl' | 'group' | 'project'> {
  disabledTabs: Tab[];
  eventRoute: LocationDescriptor;
}

export function GroupHeaderTabs({
  baseUrl,
  disabledTabs,
  eventRoute,
  group,
  project,
}: GroupHeaderTabsProps) {
  const organization = useOrganization();
  const location = useLocation();

  const {getReplayCountForIssue} = useReplayCountForIssues({
    statsPeriod: '90d',
  });
  const replaysCount = getReplayCountForIssue(group.id, group.issueCategory);

  // omit `sort` param from the URLs because it persists from the issues list,
  // which can cause the tab content rendering to break
  const queryParams = omit(location.query, ['sort']);

  const projectFeatures = new Set(project ? project.features : []);
  const organizationFeatures = new Set(organization ? organization.features : []);

  const hasSimilarView = projectFeatures.has('similarity-view');
  const hasEventAttachments = organizationFeatures.has('event-attachments');
  const hasReplaySupport =
    organizationFeatures.has('session-replay') &&
    projectCanLinkToReplay(organization, project);

  const issueTypeConfig = getConfigForIssueType(group, project);

  useRouteAnalyticsParams({
    group_has_replay: (replaysCount ?? 0) > 0,
  });

  useEffect(() => {
    if (group.issueType === IssueType.REPLAY_HYDRATION_ERROR) {
      trackAnalytics('replay.hydration-error.issue-details-opened', {organization});
    }
  }, [group.issueType, organization]);

  return (
    <StyledTabList hideBorder>
      <TabList.Item
        key={Tab.DETAILS}
        disabled={disabledTabs.includes(Tab.DETAILS)}
        to={`${baseUrl}${location.search}`}
      >
        {t('Details')}
      </TabList.Item>
      <TabList.Item
        key={Tab.ACTIVITY}
        textValue={t('Activity')}
        disabled={disabledTabs.includes(Tab.ACTIVITY)}
        to={{pathname: `${baseUrl}activity/`, query: queryParams}}
      >
        {t('Activity')}
        <IconBadge type="default">
          {group.numComments}
          <IconChat size="xs" />
        </IconBadge>
      </TabList.Item>
      <TabList.Item
        key={Tab.USER_FEEDBACK}
        textValue={t('User Feedback')}
        hidden={!issueTypeConfig.pages.userFeedback.enabled}
        disabled={disabledTabs.includes(Tab.USER_FEEDBACK)}
        to={{pathname: `${baseUrl}feedback/`, query: queryParams}}
      >
        {t('User Feedback')} <Badge type="default">{group.userReportCount}</Badge>
      </TabList.Item>
      <TabList.Item
        key={Tab.ATTACHMENTS}
        hidden={!hasEventAttachments || !issueTypeConfig.pages.attachments.enabled}
        disabled={disabledTabs.includes(Tab.ATTACHMENTS)}
        to={{pathname: `${baseUrl}attachments/`, query: queryParams}}
      >
        {t('Attachments')}
      </TabList.Item>
      <TabList.Item
        key={Tab.TAGS}
        hidden={!issueTypeConfig.pages.tagsTab.enabled}
        disabled={disabledTabs.includes(Tab.TAGS)}
        to={{pathname: `${baseUrl}tags/`, query: queryParams}}
      >
        {t('Tags')}
      </TabList.Item>
      <TabList.Item
        key={Tab.EVENTS}
        hidden={!issueTypeConfig.pages.events.enabled}
        disabled={disabledTabs.includes(Tab.EVENTS)}
        to={eventRoute}
      >
        {group.issueCategory === IssueCategory.ERROR
          ? t('All Events')
          : t('Sampled Events')}
      </TabList.Item>
      <TabList.Item
        key={Tab.MERGED}
        hidden={!issueTypeConfig.mergedIssues.enabled}
        disabled={disabledTabs.includes(Tab.MERGED)}
        to={{pathname: `${baseUrl}merged/`, query: queryParams}}
      >
        {t('Merged Issues')}
      </TabList.Item>
      <TabList.Item
        key={Tab.SIMILAR_ISSUES}
        hidden={!hasSimilarView || !issueTypeConfig.similarIssues.enabled}
        disabled={disabledTabs.includes(Tab.SIMILAR_ISSUES)}
        to={{pathname: `${baseUrl}similar/`, query: queryParams}}
      >
        {t('Similar Issues')}
      </TabList.Item>
      <TabList.Item
        key={Tab.REPLAYS}
        textValue={t('Replays')}
        hidden={!hasReplaySupport || !issueTypeConfig.pages.replays.enabled}
        to={{pathname: `${baseUrl}replays/`, query: queryParams}}
      >
        {t('Replays')}
        <ReplayCountBadge count={replaysCount} />
      </TabList.Item>
      <TabList.Item
        key={Tab.UPTIME_CHECKS}
        textValue={t('Uptime Checks')}
        hidden={!issueTypeConfig.pages.uptimeChecks.enabled}
        to={{pathname: `${baseUrl}${TabPaths[Tab.UPTIME_CHECKS]}`, query: queryParams}}
      >
        {t('Uptime Checks')}
      </TabList.Item>
    </StyledTabList>
  );
}

function GroupHeader({baseUrl, group, organization, event, project}: Props) {
  const location = useLocation();
  const groupReprocessingStatus = getGroupReprocessingStatus(group);

  const {
    disabledTabs,
    message,
    eventRoute,
    disableActions,
    shortIdBreadcrumb,
    className,
  } = useIssueDetailsHeader({
    group,
    groupReprocessingStatus,
    baseUrl,
    project,
  });

  const {userCount} = group;

  const issueTypeConfig = getConfigForIssueType(group, project);

  const NEW_ISSUE_TYPES = [IssueType.REPLAY_HYDRATION_ERROR]; // adds a "new" banner next to the title

  return (
    <Layout.Header>
      <div className={className}>
        <BreadcrumbActionWrapper>
          <Breadcrumbs
            crumbs={[
              {
                label: 'Issues',
                to: {
                  pathname: `/organizations/${organization.slug}/issues/`,
                  // Sanitize sort queries from query
                  query: omit(location.query, 'sort'),
                },
              },
              {label: shortIdBreadcrumb},
            ]}
          />
          <GroupActions
            group={group}
            project={project}
            disabled={disableActions}
            event={event}
          />
        </BreadcrumbActionWrapper>
        <HeaderRow>
          <TitleWrapper>
            <TitleHeading>
              {NEW_ISSUE_TYPES.includes(group.issueType) && (
                <StyledFeatureBadge type="new" />
              )}
              <h3>
                <StyledEventOrGroupTitle data={group} />
              </h3>
              <GroupStatusBadge
                status={group.status}
                substatus={group.substatus}
                fontSize="md"
              />
            </TitleHeading>
            <EventMessage
              data={group}
              message={message}
              level={group.level}
              levelIndicatorSize="11px"
              type={group.type}
              showUnhandled={group.isUnhandled}
            />
          </TitleWrapper>
          <StatsWrapper>
            {issueTypeConfig.stats.enabled && (
              <Fragment>
                <GuideAnchor target="issue_header_stats">
                  <div className="count">
                    <h6 className="nav-header">{t('Events')}</h6>
                    <Link disabled={disableActions} to={eventRoute}>
                      <Count className="count" value={group.count} />
                    </Link>
                  </div>
                </GuideAnchor>
                <div className="count">
                  <h6 className="nav-header">{t('Users')}</h6>
                  {userCount !== 0 ? (
                    <Link
                      disabled={disableActions}
                      to={`${baseUrl}tags/user/${location.search}`}
                    >
                      <Count className="count" value={userCount} />
                    </Link>
                  ) : (
                    <span>0</span>
                  )}
                </div>
              </Fragment>
            )}
            <PriorityContainer>
              <h6 className="nav-header">{t('Priority')}</h6>
              <GroupPriority group={group} />
            </PriorityContainer>
          </StatsWrapper>
        </HeaderRow>
        {/* Environment picker for mobile */}
        <HeaderRow className="hidden-sm hidden-md hidden-lg">
          <EnvironmentPageFilter position="bottom-end" />
        </HeaderRow>
        <GroupHeaderTabs {...{baseUrl, disabledTabs, eventRoute, group, project}} />
      </div>
    </Layout.Header>
  );
}

export default GroupHeader;

const BreadcrumbActionWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: ${space(1)};
  align-items: center;
`;

const HeaderRow = styled('div')`
  display: flex;
  gap: ${space(2)};
  justify-content: space-between;
  margin-top: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: column;
  }
`;

const TitleWrapper = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    max-width: 65%;
  }
`;

const TitleHeading = styled('div')`
  display: flex;
  line-height: 2;
  gap: ${space(1)};
`;

const StyledEventOrGroupTitle = styled(EventOrGroupTitle)`
  font-size: inherit;
`;

const StatsWrapper = styled('div')`
  display: flex;
  gap: calc(${space(3)} + ${space(3)});

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    justify-content: flex-end;
  }
`;

const IconBadge = styled(Badge)`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const StyledTabList = styled(TabList)`
  margin-top: ${space(2)};
`;

const PriorityContainer = styled('div')`
  /* Ensures that the layout doesn't shift when changing priority */
  min-width: 80px;
`;

const StyledFeatureBadge = styled(FeatureBadge)`
  align-items: flex-start;
`;
