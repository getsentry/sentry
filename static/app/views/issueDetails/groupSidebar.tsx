import {Fragment} from 'react';
import styled from '@emotion/styled';

import AvatarList from 'sentry/components/avatar/avatarList';
import {DateTime} from 'sentry/components/dateTime';
import type {OnAssignCallback} from 'sentry/components/deprecatedAssigneeSelectorDropdown';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {EventThroughput} from 'sentry/components/events/eventStatisticalDetector/eventThroughput';
import AssignedTo from 'sentry/components/group/assignedTo';
import ExternalIssueList from 'sentry/components/group/externalIssuesList';
import {StreamlinedExternalIssueList} from 'sentry/components/group/externalIssuesList/streamlinedExternalIssueList';
import GroupReleaseStats from 'sentry/components/group/releaseStats';
import TagFacets, {
  BACKEND_TAGS,
  DEFAULT_TAGS,
  FRONTEND_TAGS,
  MOBILE_TAGS,
  TAGS_FORMATTER,
} from 'sentry/components/group/tagFacets';
import QuestionTooltip from 'sentry/components/questionTooltip';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {backend, frontend} from 'sentry/data/platformCategories';
import {t, tn} from 'sentry/locale';
import IssueListCacheStore from 'sentry/stores/IssueListCacheStore';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group, TeamParticipant, UserParticipant} from 'sentry/types/group';
import type {Organization, OrganizationSummary} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {CurrentRelease} from 'sentry/types/release';
import type {AvatarUser} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {userDisplayName} from 'sentry/utils/formatters';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {isMobilePlatform} from 'sentry/utils/platform';
import {getAnalyicsDataForProject} from 'sentry/utils/projects';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useUser} from 'sentry/utils/useUser';
import {ParticipantList} from 'sentry/views/issueDetails/participantList';
import SolutionsSection from 'sentry/views/issueDetails/streamline/solutionsSection';
import {makeFetchGroupQueryKey} from 'sentry/views/issueDetails/useGroup';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

type Props = {
  environments: string[];
  group: Group;
  organization: Organization;
  project: Project;
  event?: Event;
};

export function useFetchAllEnvsGroupData(
  organization: OrganizationSummary,
  group: Group
) {
  return useApiQuery<Group>(
    makeFetchGroupQueryKey({
      organizationSlug: organization.slug,
      groupId: group.id,
      environments: [],
    }),
    {
      staleTime: 30000,
      gcTime: 30000,
    }
  );
}

function useFetchCurrentRelease(organization: OrganizationSummary, group: Group) {
  return useApiQuery<CurrentRelease>(
    [`/organizations/${organization.slug}/issues/${group.id}/current-release/`],
    {
      staleTime: 30000,
      gcTime: 30000,
    }
  );
}

export default function GroupSidebar({
  event,
  group,
  project,
  organization,
  environments,
}: Props) {
  const activeUser = useUser();
  const {data: allEnvironmentsGroupData} = useFetchAllEnvsGroupData(organization, group);
  const {data: currentRelease} = useFetchCurrentRelease(organization, group);
  const hasStreamlinedUI = useHasStreamlinedUI();

  const location = useLocation();

  const onAssign: OnAssignCallback = (type, _assignee, suggestedAssignee) => {
    const {alert_date, alert_rule_id, alert_type} = location.query;
    trackAnalytics('issue_details.action_clicked', {
      organization,
      action_type: 'assign',
      assigned_type: type,
      assigned_suggestion_reason: suggestedAssignee?.suggestedReason,
      alert_date:
        typeof alert_date === 'string' ? getUtcDateString(Number(alert_date)) : undefined,
      alert_rule_id: typeof alert_rule_id === 'string' ? alert_rule_id : undefined,
      alert_type: typeof alert_type === 'string' ? alert_type : undefined,
      ...getAnalyticsDataForGroup(group),
      ...getAnalyicsDataForProject(project),
    });
    IssueListCacheStore.reset();
  };

  const renderPluginIssue = () => {
    const issues: React.ReactNode[] = [];
    (group.pluginIssues || []).forEach(plugin => {
      const issue = plugin.issue;
      // # TODO(dcramer): remove plugin.title check in Sentry 8.22+
      if (issue) {
        issues.push(
          <Fragment key={plugin.slug}>
            <span>{`${plugin.shortName || plugin.name || plugin.title}: `}</span>
            <a href={issue.url}>
              {typeof issue.label === 'object' ? issue.label.id : issue.label}
            </a>
          </Fragment>
        );
      }
    });

    if (!issues.length) {
      return null;
    }

    return (
      <SidebarSection.Wrap>
        <SidebarSection.Title>{t('External Issues')}</SidebarSection.Title>
        <SidebarSection.Content>
          <ExternalIssues>{issues}</ExternalIssues>
        </SidebarSection.Content>
      </SidebarSection.Wrap>
    );
  };

  const renderParticipantData = () => {
    const {participants} = group;
    if (!participants.length) {
      return null;
    }

    const userParticipants = participants.filter(
      (p): p is UserParticipant => p.type === 'user'
    );
    const teamParticipants = participants.filter(
      (p): p is TeamParticipant => p.type === 'team'
    );

    const getParticipantTitle = (): React.ReactNode => {
      const individualText = tn(
        '%s Individual',
        '%s Individuals',
        userParticipants.length
      );
      const teamText = tn('%s Team', '%s Teams', teamParticipants.length);

      if (teamParticipants.length === 0) {
        return individualText;
      }

      if (userParticipants.length === 0) {
        return teamText;
      }

      return (
        <Fragment>
          {teamText}, {individualText}
        </Fragment>
      );
    };

    const avatars = (
      <StyledAvatarList
        users={userParticipants}
        teams={teamParticipants}
        avatarSize={28}
        maxVisibleAvatars={12}
        typeAvatars="participants"
      />
    );

    return (
      <SmallerSidebarWrap>
        <SidebarSection.Title>
          {t('Participants')} <TitleNumber>({getParticipantTitle()})</TitleNumber>
          <QuestionTooltip
            size="xs"
            position="top"
            title={t(
              'People who have been assigned, resolved, unresolved, archived, bookmarked, subscribed, or added a comment'
            )}
          />
        </SidebarSection.Title>
        <SidebarSection.Content>
          <ParticipantList
            users={userParticipants}
            teams={teamParticipants}
            description={t('participants')}
          >
            {avatars}
          </ParticipantList>
        </SidebarSection.Content>
      </SmallerSidebarWrap>
    );
  };

  const renderSeenByList = () => {
    const {seenBy} = group;
    const displayUsers = seenBy.filter(user => activeUser.id !== user.id);

    if (!displayUsers.length) {
      return null;
    }

    const avatars = (
      <StyledAvatarList
        users={displayUsers}
        avatarSize={28}
        maxVisibleAvatars={12}
        renderTooltip={user => (
          <Fragment>
            {userDisplayName(user)}
            <br />
            <DateTime date={(user as AvatarUser).lastSeen} />
          </Fragment>
        )}
      />
    );

    return (
      <SmallerSidebarWrap>
        <SidebarSection.Title>
          {t('Viewers')}
          <TitleNumber>({displayUsers.length})</TitleNumber>
          <QuestionTooltip
            size="xs"
            position="top"
            title={t('People who have viewed this issue')}
          />
        </SidebarSection.Title>
        <SidebarSection.Content>
          <ParticipantList users={displayUsers} teams={[]} description={t('users')}>
            {avatars}
          </ParticipantList>
        </SidebarSection.Content>
      </SmallerSidebarWrap>
    );
  };

  const issueTypeConfig = getConfigForIssueType(group, project);

  return (
    <Container>
      {((organization.features.includes('ai-summary') &&
        issueTypeConfig.issueSummary.enabled &&
        !organization.hideAiFeatures) ||
        issueTypeConfig.resources) && (
        <SolutionsSectionContainer>
          <SolutionsSection group={group} project={project} event={event} />
        </SolutionsSectionContainer>
      )}

      {hasStreamlinedUI && event && (
        <ErrorBoundary mini>
          <StreamlinedExternalIssueList group={group} event={event} project={project} />
        </ErrorBoundary>
      )}
      {!hasStreamlinedUI && (
        <AssignedTo group={group} event={event} project={project} onAssign={onAssign} />
      )}
      {issueTypeConfig.stats.enabled && (
        <GroupReleaseStats
          organization={organization}
          project={project}
          environments={environments}
          allEnvironments={allEnvironmentsGroupData}
          group={group}
          currentRelease={currentRelease}
        />
      )}
      {!hasStreamlinedUI && event && (
        <ErrorBoundary mini>
          <ExternalIssueList project={project} group={group} event={event} />
        </ErrorBoundary>
      )}
      {!hasStreamlinedUI && renderPluginIssue()}
      {issueTypeConfig.tagsTab.enabled && (
        <TagFacets
          environments={environments}
          groupId={group.id}
          tagKeys={
            isMobilePlatform(project?.platform)
              ? MOBILE_TAGS
              : frontend.some(val => val === project?.platform)
                ? FRONTEND_TAGS
                : backend.some(val => val === project?.platform)
                  ? BACKEND_TAGS
                  : DEFAULT_TAGS
          }
          tagFormatter={TAGS_FORMATTER}
          project={project}
        />
      )}
      {issueTypeConfig.regression.enabled && event && (
        <EventThroughput event={event} group={group} />
      )}
      {!hasStreamlinedUI && renderParticipantData()}
      {!hasStreamlinedUI && renderSeenByList()}
    </Container>
  );
}

const SolutionsSectionContainer = styled('div')`
  margin-bottom: ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
  padding-bottom: ${space(2)};
`;

const Container = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const ExternalIssues = styled('div')`
  display: grid;
  grid-template-columns: auto max-content;
  gap: ${space(2)};
`;

const StyledAvatarList = styled(AvatarList)`
  justify-content: flex-end;
  padding-left: ${space(0.75)};
`;

const TitleNumber = styled('span')`
  font-weight: ${p => p.theme.fontWeightNormal};
`;

// Using 22px + space(1) = space(4)
const SmallerSidebarWrap = styled(SidebarSection.Wrap)`
  margin-bottom: 22px;
`;
