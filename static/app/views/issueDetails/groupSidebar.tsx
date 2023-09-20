import {Fragment} from 'react';
import styled from '@emotion/styled';
import isObject from 'lodash/isObject';

import type {OnAssignCallback} from 'sentry/components/assigneeSelectorDropdown';
import AvatarList from 'sentry/components/avatar/avatarList';
import DateTime from 'sentry/components/dateTime';
import ErrorBoundary from 'sentry/components/errorBoundary';
import AssignedTo from 'sentry/components/group/assignedTo';
import ExternalIssueList from 'sentry/components/group/externalIssuesList';
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
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {
  AvatarUser,
  CurrentRelease,
  Group,
  IssueType,
  Organization,
  OrganizationSummary,
  Project,
  TeamParticipant,
  UserParticipant,
} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {userDisplayName} from 'sentry/utils/formatters';
import {isMobilePlatform} from 'sentry/utils/platform';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {getGroupDetailsQueryData} from 'sentry/views/issueDetails/utils';

type Props = {
  environments: string[];
  group: Group;
  organization: Organization;
  project: Project;
  event?: Event;
};

function useFetchAllEnvsGroupData(organization: OrganizationSummary, group: Group) {
  return useApiQuery<Group>(
    [
      `/organizations/${organization.slug}/issues/${group.id}/`,
      {query: getGroupDetailsQueryData()},
    ],
    {
      staleTime: 30000,
      cacheTime: 30000,
    }
  );
}

function useFetchCurrentRelease(organization: OrganizationSummary, group: Group) {
  return useApiQuery<CurrentRelease>(
    [`/organizations/${organization.slug}/issues/${group.id}/current-release/`],
    {
      staleTime: 30000,
      cacheTime: 30000,
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
  const {data: allEnvironmentsGroupData} = useFetchAllEnvsGroupData(organization, group);
  const {data: currentRelease} = useFetchCurrentRelease(organization, group);
  const location = useLocation();

  const trackAssign: OnAssignCallback = (type, _assignee, suggestedAssignee) => {
    const {alert_date, alert_rule_id, alert_type} = location.query;
    trackAnalytics('issue_details.action_clicked', {
      organization,
      project_id: parseInt(project.id, 10),
      action_type: 'assign',
      assigned_type: type,
      assigned_suggestion_reason: suggestedAssignee?.suggestedReason,
      alert_date:
        typeof alert_date === 'string' ? getUtcDateString(Number(alert_date)) : undefined,
      alert_rule_id: typeof alert_rule_id === 'string' ? alert_rule_id : undefined,
      alert_type: typeof alert_type === 'string' ? alert_type : undefined,
      ...getAnalyticsDataForGroup(group),
    });
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
            <a href={issue.url}>{isObject(issue.label) ? issue.label.id : issue.label}</a>
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

    return (
      <SidebarSection.Wrap>
        <SidebarSection.Title>
          {t('Participants (%s)', participants.length)}
          <QuestionTooltip
            size="xs"
            position="top"
            title={t('People who have resolved, ignored, or added a comment')}
          />
        </SidebarSection.Title>
        <SidebarSection.Content>
          <StyledAvatarList
            users={userParticipants}
            teams={teamParticipants}
            avatarSize={28}
            maxVisibleAvatars={13}
            typeAvatars="participants"
          />
        </SidebarSection.Content>
      </SidebarSection.Wrap>
    );
  };

  const renderSeenByList = () => {
    const {seenBy} = group;
    const activeUser = ConfigStore.get('user');
    const displayUsers = seenBy.filter(user => activeUser.id !== user.id);

    if (!displayUsers.length) {
      return null;
    }

    return (
      <SidebarSection.Wrap>
        <SidebarSection.Title>
          {t('Viewers (%s)', displayUsers.length)}{' '}
          <QuestionTooltip
            size="xs"
            position="top"
            title={t('People who have viewed this issue')}
          />
        </SidebarSection.Title>
        <SidebarSection.Content>
          <StyledAvatarList
            users={displayUsers}
            avatarSize={28}
            maxVisibleAvatars={13}
            renderTooltip={user => (
              <Fragment>
                {userDisplayName(user)}
                <br />
                <DateTime date={(user as AvatarUser).lastSeen} />
              </Fragment>
            )}
          />
        </SidebarSection.Content>
      </SidebarSection.Wrap>
    );
  };

  return (
    <Container>
      <AssignedTo group={group} event={event} project={project} onAssign={trackAssign} />
      {group.issueType !== IssueType.PERFORMANCE_DURATION_REGRESSION && (
        <GroupReleaseStats
          organization={organization}
          project={project}
          environments={environments}
          allEnvironments={allEnvironmentsGroupData}
          group={group}
          currentRelease={currentRelease}
        />
      )}
      {event && (
        <ErrorBoundary mini>
          <ExternalIssueList project={project} group={group} event={event} />
        </ErrorBoundary>
      )}
      {renderPluginIssue()}
      <TagFacets
        environments={environments}
        groupId={group.id}
        tagKeys={
          isMobilePlatform(project?.platform)
            ? !organization.features.includes('device-classification')
              ? MOBILE_TAGS.filter(tag => tag !== 'device.class')
              : MOBILE_TAGS
            : frontend.some(val => val === project?.platform)
            ? FRONTEND_TAGS
            : backend.some(val => val === project?.platform)
            ? BACKEND_TAGS
            : DEFAULT_TAGS
        }
        event={event}
        tagFormatter={TAGS_FORMATTER}
        project={project}
      />
      {renderParticipantData()}
      {renderSeenByList()}
    </Container>
  );
}

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
