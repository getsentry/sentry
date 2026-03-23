import {Fragment} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {EventThroughput} from 'sentry/components/events/eventStatisticalDetector/eventThroughput';
import {AssignedTo} from 'sentry/components/group/assignedTo';
import type {OnAssignCallback} from 'sentry/components/group/assigneeSelector';
import {ExternalIssueList} from 'sentry/components/group/externalIssuesList';
import {
  BACKEND_TAGS,
  DEFAULT_TAGS,
  FRONTEND_TAGS,
  MOBILE_TAGS,
  TagFacets,
  TAGS_FORMATTER,
} from 'sentry/components/group/tagFacets';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {backend, frontend} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import {IssueListCacheStore} from 'sentry/stores/IssueListCacheStore';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization, OrganizationSummary} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {isMobilePlatform} from 'sentry/utils/platform';
import {getAnalyicsDataForProject} from 'sentry/utils/projects';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';
import {SeerSection} from 'sentry/views/issueDetails/streamline/sidebar/seerSection';
import {makeFetchGroupQueryKey} from 'sentry/views/issueDetails/useGroup';

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
    {staleTime: 30000, gcTime: 30000}
  );
}

export function GroupSidebar({event, group, project, organization, environments}: Props) {
  const location = useLocation();

  const {areAiFeaturesAllowed} = useAiConfig(group, project);

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
      org_streamline_only: organization.streamlineOnly ?? undefined,
      ...getAnalyticsDataForGroup(group),
      ...getAnalyicsDataForProject(project),
    });
    IssueListCacheStore.reset();
  };

  const renderPluginIssue = () => {
    const issues: React.ReactNode[] = [];
    (group.pluginIssues || []).forEach(plugin => {
      const issue = plugin.issue;
      if (issue) {
        issues.push(
          <Fragment key={plugin.slug}>
            <span>{`${plugin.shortName || plugin.name}: `}</span>
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

  const issueTypeConfig = getConfigForIssueType(group, project);

  return (
    <Container>
      {((areAiFeaturesAllowed && issueTypeConfig.issueSummary.enabled) ||
        issueTypeConfig.resources) && (
        <ErrorBoundary mini>
          <SeerSection group={group} project={project} event={event} />
        </ErrorBoundary>
      )}
      <AssignedTo group={group} event={event} project={project} onAssign={onAssign} />
      {event && (
        <ErrorBoundary mini>
          <ExternalIssueList project={project} group={group} event={event} />
        </ErrorBoundary>
      )}
      {renderPluginIssue()}
      {issueTypeConfig.pages.tagsTab.enabled && (
        <TagFacets
          environments={environments}
          groupId={group.id}
          tagKeys={
            isMobilePlatform(project.platform)
              ? MOBILE_TAGS
              : frontend.includes(project.platform ?? 'other')
                ? FRONTEND_TAGS
                : backend.includes(project.platform ?? 'other')
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
    </Container>
  );
}

const Container = styled('div')`
  font-size: ${p => p.theme.font.size.md};
`;

const ExternalIssues = styled('div')`
  display: grid;
  grid-template-columns: auto max-content;
  gap: ${p => p.theme.space.xl};
`;
