import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import AssigneeSelector from 'sentry/components/assigneeSelector';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Badge from 'sentry/components/badge';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import Count from 'sentry/components/count';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import ErrorLevel from 'sentry/components/events/errorLevel';
import EventMessage from 'sentry/components/events/eventMessage';
import InboxReason from 'sentry/components/group/inboxBadges/inboxReason';
import UnhandledInboxTag from 'sentry/components/group/inboxBadges/unhandledTag';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import ReplayCountBadge from 'sentry/components/replays/replayCountBadge';
import ReplaysFeatureBadge from 'sentry/components/replays/replaysFeatureBadge';
import useReplaysCount from 'sentry/components/replays/useReplaysCount';
import SeenByList from 'sentry/components/seenByList';
import ShortId from 'sentry/components/shortId';
import {Item, TabList} from 'sentry/components/tabs';
import Tooltip from 'sentry/components/tooltip';
import {IconChat} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event, Group, IssueCategory, Organization, Project, User} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getUtcDateString} from 'sentry/utils/dates';
import {getMessage} from 'sentry/utils/events';
import projectSupportsReplay from 'sentry/utils/replays/projectSupportsReplay';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';

import GroupActions from './actions';
import {Tab} from './types';
import {TagAndMessageWrapper} from './unhandledTag';
import {ReprocessingStatus} from './utils';

type Props = {
  baseUrl: string;
  group: Group;
  groupReprocessingStatus: ReprocessingStatus;
  organization: Organization;
  project: Project;
  event?: Event;
};

type UseMemberlistProps = {
  group: Group;
  organization: Organization;
};

function useMembersList({group, organization}: UseMemberlistProps) {
  const {project} = group;
  const api = useApi();

  const [membersList, setMembersList] = useState<User[]>();

  const hasIssueDetailsOwners = organization.features.includes('issue-details-owners');
  const loadMemberList = useCallback(async () => {
    if (hasIssueDetailsOwners) {
      return;
    }

    const members = await fetchOrgMembers(api, organization.slug, [project.id]);
    setMembersList(members.map(member => member.user));
  }, [api, organization.slug, project, hasIssueDetailsOwners]);

  useEffect(() => void loadMemberList(), [loadMemberList]);

  return membersList;
}

function GroupHeader({
  baseUrl,
  group,
  groupReprocessingStatus,
  organization,
  event,
  project,
}: Props) {
  const location = useLocation();

  const replaysCount = useReplaysCount({
    groupIds: group.id,
    organization,
    project,
  })[group.id];

  const trackAssign: React.ComponentProps<typeof AssigneeSelector>['onAssign'] =
    useCallback(
      (_, __, suggestedAssignee) => {
        const {alert_date, alert_rule_id, alert_type} = location.query;
        trackAdvancedAnalyticsEvent('issue_details.action_clicked', {
          organization,
          project_id: parseInt(project.id, 10),
          group_id: parseInt(group.id, 10),
          issue_category: group.issueCategory,
          action_type: 'assign',
          assigned_suggestion_reason: suggestedAssignee?.suggestedReason,
          // Alert properties track if the user came from email/slack alerts
          alert_date:
            typeof alert_date === 'string'
              ? getUtcDateString(Number(alert_date))
              : undefined,
          alert_rule_id: typeof alert_rule_id === 'string' ? alert_rule_id : undefined,
          alert_type: typeof alert_type === 'string' ? alert_type : undefined,
        });
      },
      [group.id, group.issueCategory, project.id, organization, location.query]
    );

  const disabledTabs = useMemo(() => {
    const hasReprocessingV2Feature = organization.features.includes('reprocessing-v2');

    if (!hasReprocessingV2Feature) {
      return [];
    }

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
  }, [organization, groupReprocessingStatus]);

  const eventRouteToObject = useMemo(() => {
    const searchTermWithoutQuery = omit(location.query, 'query');
    return {
      pathname: `${baseUrl}events/`,
      query: searchTermWithoutQuery,
    };
  }, [location, baseUrl]);

  const errorIssueTabs = useMemo(() => {
    const projectFeatures = new Set(project ? project.features : []);
    const organizationFeatures = new Set(organization ? organization.features : []);

    const hasGroupingTreeUI = organizationFeatures.has('grouping-tree-ui');
    const hasSimilarView = projectFeatures.has('similarity-view');
    const hasEventAttachments = organizationFeatures.has('event-attachments');
    const hasSessionReplay =
      organizationFeatures.has('session-replay-ui') && projectSupportsReplay(project);

    return (
      <StyledTabList hideBorder>
        <Item
          key={Tab.DETAILS}
          disabled={disabledTabs.includes(Tab.DETAILS)}
          to={`${baseUrl}${location.search}`}
        >
          {t('Details')}
        </Item>
        <Item
          key={Tab.ACTIVITY}
          textValue={t('Activity')}
          disabled={disabledTabs.includes(Tab.ACTIVITY)}
          to={`${baseUrl}activity/${location.search}`}
        >
          {t('Activity')}
          <IconBadge>
            {group.numComments}
            <IconChat size="xs" />
          </IconBadge>
        </Item>
        <Item
          key={Tab.USER_FEEDBACK}
          textValue={t('User Feedback')}
          disabled={disabledTabs.includes(Tab.USER_FEEDBACK)}
          to={`${baseUrl}feedback/${location.search}`}
        >
          {t('User Feedback')} <Badge text={group.userReportCount} />
        </Item>
        <Item
          key={Tab.ATTACHMENTS}
          hidden={!hasEventAttachments}
          disabled={disabledTabs.includes(Tab.ATTACHMENTS)}
          to={`${baseUrl}attachments/${location.search}`}
        >
          {t('Attachments')}
        </Item>
        <Item
          key={Tab.TAGS}
          disabled={disabledTabs.includes(Tab.TAGS)}
          to={`${baseUrl}tags/${location.search}`}
        >
          {t('Tags')}
        </Item>
        <Item
          key={Tab.EVENTS}
          disabled={disabledTabs.includes(Tab.EVENTS)}
          to={eventRouteToObject}
        >
          {t('All Events')}
        </Item>
        <Item
          key={Tab.MERGED}
          disabled={disabledTabs.includes(Tab.MERGED)}
          to={`${baseUrl}merged/${location.search}`}
        >
          {t('Merged Issues')}
        </Item>
        <Item
          key={Tab.GROUPING}
          hidden={!hasGroupingTreeUI}
          disabled={disabledTabs.includes(Tab.GROUPING)}
          to={`${baseUrl}grouping/${location.search}`}
        >
          {t('Grouping')}
        </Item>
        <Item
          key={Tab.SIMILAR_ISSUES}
          hidden={!hasSimilarView}
          disabled={disabledTabs.includes(Tab.SIMILAR_ISSUES)}
          to={`${baseUrl}similar/${location.search}`}
        >
          {t('Similar Issues')}
        </Item>
        <Item
          key={Tab.REPLAYS}
          textValue={t('Replays')}
          hidden={!hasSessionReplay}
          to={`${baseUrl}replays/${location.search}`}
        >
          {t('Replays')}
          <ReplayCountBadge count={replaysCount} />
          <ReplaysFeatureBadge noTooltip />
        </Item>
      </StyledTabList>
    );
  }, [
    baseUrl,
    location,
    disabledTabs,
    group.numComments,
    group.userReportCount,
    organization,
    project,
    replaysCount,
    eventRouteToObject,
  ]);

  const performanceIssueTabs = useMemo(() => {
    return (
      <StyledTabList hideBorder>
        <Item
          key={Tab.DETAILS}
          disabled={disabledTabs.includes(Tab.DETAILS)}
          to={`${baseUrl}${location.search}`}
        >
          {t('Details')}
        </Item>
        <Item
          key={Tab.ACTIVITY}
          textValue={t('Activity')}
          disabled={disabledTabs.includes(Tab.ACTIVITY)}
          to={`${baseUrl}activity/${location.search}`}
        >
          {t('Activity')}
          <IconBadge>
            {group.numComments}
            <IconChat size="xs" />
          </IconBadge>
        </Item>
        <Item
          key={Tab.TAGS}
          disabled={disabledTabs.includes(Tab.TAGS)}
          to={`${baseUrl}tags/${location.search}`}
        >
          {t('Tags')}
        </Item>
        <Item
          key={Tab.EVENTS}
          disabled={disabledTabs.includes(Tab.EVENTS)}
          to={eventRouteToObject}
        >
          {t('Events')}
        </Item>
      </StyledTabList>
    );
  }, [disabledTabs, group.numComments, baseUrl, location, eventRouteToObject]);

  const membersList = useMembersList({group, organization});
  const hasIssueDetailsOwners = organization.features.includes('issue-details-owners');
  const {userCount} = group;

  let className = 'group-detail';

  if (group.hasSeen) {
    className += ' hasSeen';
  }

  if (group.status === 'resolved') {
    className += ' isResolved';
  }

  const message = getMessage(group);

  const disableActions = !!disabledTabs.length;

  const shortIdBreadCrumb = group.shortId && (
    <GuideAnchor target="issue_number" position="bottom">
      <ShortIdBreadrcumb>
        <ProjectBadge
          project={project}
          avatarSize={16}
          hideName
          avatarProps={{hasTooltip: true, tooltip: project.slug}}
        />
        <Tooltip
          className="help-link"
          title={t(
            'This identifier is unique across your organization, and can be used to reference an issue in various places, like commit messages.'
          )}
          position="bottom"
        >
          <StyledShortId shortId={group.shortId} />
        </Tooltip>
      </ShortIdBreadrcumb>
    </GuideAnchor>
  );

  const hasIssueActionsV2 = organization.features.includes('issue-actions-v2');

  return (
    <Layout.Header>
      <div className={className}>
        <BreadcrumbActionWrapper>
          <Breadcrumbs
            crumbs={[
              {
                label: 'Issues',
                to: `/organizations/${organization.slug}/issues/${location.search}`,
              },
              {label: shortIdBreadCrumb},
            ]}
          />
          {hasIssueActionsV2 && (
            <GroupActions
              group={group}
              project={project}
              disabled={disableActions}
              event={event}
              query={location.query}
            />
          )}
        </BreadcrumbActionWrapper>
        <HeaderRow>
          <TitleWrapper>
            <TitleHeading>
              <h3>
                <StyledEventOrGroupTitle hasGuideAnchor data={group} />
              </h3>
              {group.inbox && <InboxReason inbox={group.inbox} fontSize="md" />}
            </TitleHeading>
            <StyledTagAndMessageWrapper>
              {group.level && <ErrorLevel level={group.level} size="11px" />}
              {group.isUnhandled && <UnhandledInboxTag />}
              <EventMessage message={message} />
            </StyledTagAndMessageWrapper>
          </TitleWrapper>
          <StatsWrapper numItems={hasIssueDetailsOwners ? '2' : '3'}>
            <div className="count">
              <h6 className="nav-header">{t('Events')}</h6>
              <Link disabled={disableActions} to={eventRouteToObject}>
                <Count className="count" value={group.count} />
              </Link>
            </div>
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
            {!hasIssueDetailsOwners && (
              <div data-test-id="assigned-to">
                <h6 className="nav-header">{t('Assignee')}</h6>
                <AssigneeSelector
                  id={group.id}
                  memberList={membersList}
                  disabled={disableActions}
                  onAssign={trackAssign}
                />
              </div>
            )}
          </StatsWrapper>
        </HeaderRow>
        {hasIssueActionsV2 ? (
          // Environment picker for mobile
          <HeaderRow className="hidden-sm hidden-md hidden-lg">
            <EnvironmentPageFilter alignDropdown="right" />
          </HeaderRow>
        ) : (
          <HeaderRow>
            <GroupActions
              group={group}
              project={project}
              disabled={disableActions}
              event={event}
              query={location.query}
            />
            <StyledSeenByList
              seenBy={group.seenBy}
              iconTooltip={t('People who have viewed this issue')}
            />
          </HeaderRow>
        )}
        {group.issueCategory === IssueCategory.PERFORMANCE
          ? performanceIssueTabs
          : errorIssueTabs}
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

const ShortIdBreadrcumb = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const StyledShortId = styled(ShortId)`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSizeMedium};
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

const StyledSeenByList = styled(SeenByList)`
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

const StyledEventOrGroupTitle = styled(EventOrGroupTitle)`
  font-size: inherit;
`;

const StatsWrapper = styled('div')<{numItems: '2' | '3'}>`
  display: grid;
  grid-template-columns: repeat(${p => p.numItems}, min-content);
  gap: calc(${space(3)} + ${space(3)});

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    justify-content: flex-end;
  }
`;

const StyledTagAndMessageWrapper = styled(TagAndMessageWrapper)`
  display: flex;
  gap: ${space(1)};
  justify-content: flex-start;
  line-height: 1.2;
`;

const IconBadge = styled(Badge)`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const StyledTabList = styled(TabList)`
  margin-top: ${space(2)};
`;
