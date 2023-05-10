import {Fragment, useCallback, useEffect, useState} from 'react';
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
  Environment,
  Group,
  Organization,
  Project,
} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {userDisplayName} from 'sentry/utils/formatters';
import {isMobilePlatform} from 'sentry/utils/platform';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';

type Props = {
  environments: Environment[];
  group: Group;
  organization: Organization;
  project: Project;
  event?: Event;
};

export default function GroupSidebar({
  event,
  group,
  project,
  organization,
  environments,
}: Props) {
  const [allEnvironmentsGroupData, setAllEnvironmentsGroupData] = useState<
    Group | undefined
  >();
  const [currentRelease, setCurrentRelease] = useState<CurrentRelease | undefined>();
  const api = useApi();
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
  const fetchAllEnvironmentsGroupData = useCallback(async () => {
    // Fetch group data for all environments since the one passed in props is filtered for the selected environment
    // The charts rely on having all environment data as well as the data for the selected env
    try {
      const query = {collapse: 'release'};
      const _allEnvironmentsGroupData = await api.requestPromise(`/issues/${group.id}/`, {
        query,
      });
      setAllEnvironmentsGroupData(_allEnvironmentsGroupData);
    } catch {
      /* empty */
    }
  }, [api, group.id]);

  const fetchCurrentRelease = useCallback(async () => {
    try {
      const {currentRelease: _currentRelease} = await api.requestPromise(
        `/issues/${group.id}/current-release/`
      );
      setCurrentRelease(_currentRelease);
    } catch {
      /* empty */
    }
  }, [api, group.id]);

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

    return (
      <SidebarSection.Wrap>
        <StyledSidebarSectionTitle>
          {t('Participants (%s)', participants.length)}
          <QuestionTooltip
            size="sm"
            position="top"
            title={t('People who have resolved, ignored, or added a comment')}
          />
        </StyledSidebarSectionTitle>
        <SidebarSection.Content>
          <StyledAvatarList users={participants} avatarSize={28} maxVisibleAvatars={13} />
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
        <StyledSidebarSectionTitle>
          {t('Viewers (%s)', displayUsers.length)}{' '}
          <QuestionTooltip
            size="sm"
            position="top"
            title={t('People who have viewed this issue')}
          />
        </StyledSidebarSectionTitle>
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

  useEffect(() => {
    fetchAllEnvironmentsGroupData();
    fetchCurrentRelease();
  }, [fetchAllEnvironmentsGroupData, fetchCurrentRelease]);

  return (
    <Container>
      <AssignedTo group={group} event={event} project={project} onAssign={trackAssign} />
      <GroupReleaseStats
        organization={organization}
        project={project}
        environments={environments}
        allEnvironments={allEnvironmentsGroupData}
        group={group}
        currentRelease={currentRelease}
      />
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

const StyledSidebarSectionTitle = styled(SidebarSection.Title)`
  gap: ${space(1)};
`;
