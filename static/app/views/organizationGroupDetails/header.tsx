import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
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
import FeatureBadge from 'sentry/components/featureBadge';
import InboxReason from 'sentry/components/group/inboxBadges/inboxReason';
import UnhandledInboxTag from 'sentry/components/group/inboxBadges/unhandledTag';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import ListLink from 'sentry/components/links/listLink';
import NavTabs from 'sentry/components/navTabs';
import ReplaysFeatureBadge from 'sentry/components/replays/replaysFeatureBadge';
import SeenByList from 'sentry/components/seenByList';
import ShortId from 'sentry/components/shortId';
import Tooltip from 'sentry/components/tooltip';
import {IconChat} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event, Group, IssueCategory, Organization, Project, User} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getUtcDateString} from 'sentry/utils/dates';
import {getMessage} from 'sentry/utils/events';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';

import GroupActions from './actions';
import {Tab} from './types';
import {TagAndMessageWrapper} from './unhandledTag';
import {ReprocessingStatus} from './utils';

type Props = {
  baseUrl: string;
  currentTab: string;
  group: Group;
  groupReprocessingStatus: ReprocessingStatus;
  organization: Organization;
  project: Project;
  replaysCount: number | undefined;
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

  const loadMemberList = useCallback(async () => {
    const members = await fetchOrgMembers(api, organization.slug, [project.id]);
    setMembersList(members.map(member => member.user));
  }, [api, organization.slug, project]);

  useEffect(() => void loadMemberList(), [loadMemberList]);

  return membersList;
}

function GroupHeader({
  baseUrl,
  currentTab,
  group,
  groupReprocessingStatus,
  organization,
  replaysCount,
  event,
  project,
}: Props) {
  const location = useLocation();

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

  const tabClickAnalyticsEvent = useCallback(
    (tab: Tab) =>
      trackAdvancedAnalyticsEvent('issue_details.tab_changed', {
        organization,
        group_id: parseInt(group.id, 10),
        issue_category: group.issueCategory,
        project_id: parseInt(project.id, 10),
        tab,
      }),
    [group.id, group.issueCategory, project.id, organization]
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

  const errorIssueTabs = useMemo(() => {
    const projectFeatures = new Set(project ? project.features : []);
    const organizationFeatures = new Set(organization ? organization.features : []);

    const hasGroupingTreeUI = organizationFeatures.has('grouping-tree-ui');
    const hasSimilarView = projectFeatures.has('similarity-view');
    const hasEventAttachments = organizationFeatures.has('event-attachments');

    const searchTermWithoutQuery = omit(location.query, 'query');
    const eventRouteToObject = {
      pathname: `${baseUrl}events/`,
      query: searchTermWithoutQuery,
    };

    return (
      <Fragment>
        <ListLink
          to={`${baseUrl}${location.search}`}
          isActive={() => currentTab === Tab.DETAILS}
          disabled={disabledTabs.includes(Tab.DETAILS)}
          onClick={() => tabClickAnalyticsEvent(Tab.DETAILS)}
        >
          {t('Details')}
        </ListLink>
        <ListLink
          to={`${baseUrl}activity/${location.search}`}
          isActive={() => currentTab === Tab.ACTIVITY}
          disabled={disabledTabs.includes(Tab.ACTIVITY)}
          onClick={() => tabClickAnalyticsEvent(Tab.ACTIVITY)}
        >
          {t('Activity')}
          <IconBadge>
            {group.numComments}
            <IconChat size="xs" />
          </IconBadge>
        </ListLink>
        <ListLink
          to={`${baseUrl}feedback/${location.search}`}
          isActive={() => currentTab === Tab.USER_FEEDBACK}
          disabled={disabledTabs.includes(Tab.USER_FEEDBACK)}
          onClick={() => tabClickAnalyticsEvent(Tab.USER_FEEDBACK)}
        >
          {t('User Feedback')} <Badge text={group.userReportCount} />
        </ListLink>
        {hasEventAttachments && (
          <ListLink
            to={`${baseUrl}attachments/${location.search}`}
            isActive={() => currentTab === Tab.ATTACHMENTS}
            disabled={disabledTabs.includes(Tab.ATTACHMENTS)}
            onClick={() => tabClickAnalyticsEvent(Tab.ATTACHMENTS)}
          >
            {t('Attachments')}
          </ListLink>
        )}
        <ListLink
          to={`${baseUrl}tags/${location.search}`}
          isActive={() => currentTab === Tab.TAGS}
          disabled={disabledTabs.includes(Tab.TAGS)}
          onClick={() => tabClickAnalyticsEvent(Tab.TAGS)}
        >
          {t('Tags')}
        </ListLink>
        <ListLink
          to={eventRouteToObject}
          isActive={() => currentTab === Tab.EVENTS}
          disabled={disabledTabs.includes(Tab.EVENTS)}
          onClick={() => tabClickAnalyticsEvent(Tab.EVENTS)}
        >
          {t('Events')}
        </ListLink>
        <ListLink
          to={`${baseUrl}merged/${location.search}`}
          isActive={() => currentTab === Tab.MERGED}
          disabled={disabledTabs.includes(Tab.MERGED)}
          onClick={() => tabClickAnalyticsEvent(Tab.MERGED)}
        >
          {t('Merged Issues')}
        </ListLink>
        {hasGroupingTreeUI && (
          <ListLink
            to={`${baseUrl}grouping/${location.search}`}
            isActive={() => currentTab === Tab.GROUPING}
            disabled={disabledTabs.includes(Tab.GROUPING)}
            onClick={() => tabClickAnalyticsEvent(Tab.GROUPING)}
          >
            {t('Grouping')}
          </ListLink>
        )}
        {hasSimilarView && (
          <ListLink
            to={`${baseUrl}similar/${location.search}`}
            isActive={() => currentTab === Tab.SIMILAR_ISSUES}
            disabled={disabledTabs.includes(Tab.SIMILAR_ISSUES)}
            onClick={() => tabClickAnalyticsEvent(Tab.SIMILAR_ISSUES)}
          >
            {t('Similar Issues')}
          </ListLink>
        )}
        <Feature features={['session-replay-ui']} organization={organization}>
          <ListLink
            to={`${baseUrl}replays/${location.search}`}
            isActive={() => currentTab === Tab.REPLAYS}
            onClick={() => tabClickAnalyticsEvent(Tab.REPLAYS)}
          >
            {t('Replays')}{' '}
            {replaysCount !== undefined ? <Badge text={replaysCount} /> : null}
            <ReplaysFeatureBadge noTooltip />
          </ListLink>
        </Feature>
      </Fragment>
    );
  }, [
    baseUrl,
    currentTab,
    disabledTabs,
    group.numComments,
    group.userReportCount,
    location.query,
    location.search,
    organization,
    project,
    replaysCount,
    tabClickAnalyticsEvent,
  ]);

  const performanceIssueTabs = useMemo(() => {
    const searchTermWithoutQuery = omit(location.query, 'query');
    const eventRouteToObject = {
      pathname: `${baseUrl}events/`,
      query: searchTermWithoutQuery,
    };

    return (
      <Fragment>
        <ListLink
          to={`${baseUrl}${location.search}`}
          isActive={() => currentTab === Tab.DETAILS}
          disabled={disabledTabs.includes(Tab.DETAILS)}
          onClick={() => tabClickAnalyticsEvent(Tab.DETAILS)}
        >
          {t('Details')}
        </ListLink>
        <ListLink
          to={`${baseUrl}activity/${location.search}`}
          isActive={() => currentTab === Tab.ACTIVITY}
          disabled={disabledTabs.includes(Tab.ACTIVITY)}
          onClick={() => tabClickAnalyticsEvent(Tab.ACTIVITY)}
        >
          {t('Activity')}
          <IconBadge>
            {group.numComments}
            <IconChat size="xs" />
          </IconBadge>
        </ListLink>
        <ListLink
          to={`${baseUrl}tags/${location.search}`}
          isActive={() => currentTab === Tab.TAGS}
          disabled={disabledTabs.includes(Tab.TAGS)}
          onClick={() => tabClickAnalyticsEvent(Tab.TAGS)}
        >
          {t('Tags')}
        </ListLink>
        <ListLink
          to={eventRouteToObject}
          isActive={() => currentTab === Tab.EVENTS}
          disabled={disabledTabs.includes(Tab.EVENTS)}
          onClick={() => tabClickAnalyticsEvent(Tab.EVENTS)}
        >
          {t('Events')}
        </ListLink>
      </Fragment>
    );
  }, [
    baseUrl,
    currentTab,
    disabledTabs,
    group.numComments,
    location.query,
    location.search,
    tabClickAnalyticsEvent,
  ]);

  const membersList = useMembersList({group, organization});
  const {userCount} = group;

  let className = 'group-detail';

  if (group.hasSeen) {
    className += ' hasSeen';
  }

  if (group.status === 'resolved') {
    className += ' isResolved';
  }

  const message = getMessage(group);

  const searchTermWithoutQuery = omit(location.query, 'query');
  const eventRouteToObject = {
    pathname: `${baseUrl}events/`,
    query: searchTermWithoutQuery,
  };

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
        {group.issueCategory === IssueCategory.PERFORMANCE && (
          <FeatureBadge
            type="beta"
            title="Performance issues are available for early adopters and may change"
          />
        )}
      </ShortIdBreadrcumb>
    </GuideAnchor>
  );

  return (
    <Layout.Header>
      <div className={className}>
        <Breadcrumbs
          crumbs={[
            {
              label: 'Issues',
              to: `/organizations/${organization.slug}/issues/${location.search}`,
            },
            {label: shortIdBreadCrumb},
          ]}
        />
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
              <EventMessage
                message={message}
                annotations={
                  group.logger && (
                    <EventAnnotation>
                      <Link
                        to={{
                          pathname: `/organizations/${organization.slug}/issues/`,
                          query: {query: 'logger:' + group.logger},
                        }}
                      >
                        {group.logger}
                      </Link>
                    </EventAnnotation>
                  )
                }
              />
            </StyledTagAndMessageWrapper>
          </TitleWrapper>
          <StatsWrapper>
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
            <div data-test-id="assigned-to">
              <h6 className="nav-header">{t('Assignee')}</h6>
              <AssigneeSelector
                id={group.id}
                memberList={membersList}
                disabled={disableActions}
                onAssign={trackAssign}
              />
            </div>
          </StatsWrapper>
        </HeaderRow>
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
        <NavTabs>
          {group.issueCategory === IssueCategory.PERFORMANCE
            ? performanceIssueTabs
            : errorIssueTabs}
        </NavTabs>
      </div>
    </Layout.Header>
  );
}

export default GroupHeader;

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

const StatsWrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, min-content);
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
