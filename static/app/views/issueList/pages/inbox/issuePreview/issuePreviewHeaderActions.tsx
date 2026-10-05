import {useQueryClient} from '@tanstack/react-query';
import type {LocationDescriptor} from 'history';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {bulkUpdate} from 'sentry/actionCreators/group';
import {addSuccessMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {IssueListCacheStore} from 'sentry/stores/IssueListCacheStore';
import {
  GroupStatus,
  ProgressState,
  type Group,
  type GroupStatusResolution,
} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {getAnalyicsDataForProject} from 'sentry/utils/projects';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {GroupResolutionActions} from 'sentry/views/issueDetails/actions/index';
import {groupQueryKey} from 'sentry/views/issueDetails/useGroup';
import {IssuePreviewActions} from 'sentry/views/issueList/pages/inbox/issuePreview/issuePreviewActions';
import {useIssuePreviewSeer} from 'sentry/views/issueList/pages/inbox/issuePreview/issuePreviewSeer';
import {IssuePreviewSeerActions} from 'sentry/views/issueList/pages/inbox/issuePreview/issuePreviewSeerActions';
import {useInvalidateInboxQueries} from 'sentry/views/issueList/pages/inbox/useInvalidateInboxQueries';

interface IssuePreviewHeaderActionsProps {
  group: Group;
  onContinueInSeer: () => void;
  onRetryCodeChanges: () => void;
  project: Project;
  disabled?: boolean;
}

export function OpenIssueButton({
  group,
  to,
  size = 'xs',
}: {
  group: Group;
  to: LocationDescriptor;
  size?: 'xs' | 'sm';
}) {
  return (
    <LinkButton
      to={to}
      size={size}
      analyticsEventKey="issue_inbox.open_issue_clicked"
      analyticsEventName="Issue Inbox: Open Issue Clicked"
      analyticsParams={{
        group_id: group.id,
        progress: group.derivedData?.progress,
        source: 'button',
      }}
    >
      {t('Open Issue')}
    </LinkButton>
  );
}

function IssuePreviewResolutionActions({
  disabled,
  group,
  project,
  variant = 'primary',
}: {
  disabled: boolean;
  group: Group;
  project: Project;
  variant?: 'primary' | 'secondary';
}) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const location = useLocation();
  const queryClient = useQueryClient();
  const invalidateInboxQueries = useInvalidateInboxQueries(group.id);
  async function handleUpdate(data: GroupStatusResolution) {
    const {alert_date, alert_rule_id, alert_type} = location.query;
    trackAnalytics('issue_inbox.resolve_clicked', {
      organization,
      action_type: data.status,
      action_substatus: data.substatus ?? undefined,
      action_status_details: Object.keys(data.statusDetails || {})[0],
      alert_date:
        typeof alert_date === 'string' ? getUtcDateString(Number(alert_date)) : undefined,
      alert_rule_id: typeof alert_rule_id === 'string' ? alert_rule_id : undefined,
      alert_type: typeof alert_type === 'string' ? alert_type : undefined,
      ...getAnalyticsDataForGroup(group),
      ...getAnalyicsDataForProject(project),
      org_streamline_only: organization.streamlineOnly ?? undefined,
    });

    try {
      await bulkUpdate(api, {
        orgId: organization.slug,
        projectId: project.slug,
        itemIds: [group.id],
        data,
      });
      clearIndicators();
      addSuccessMessage(
        data.status === GroupStatus.UNRESOLVED
          ? t('Issue marked unresolved')
          : t('Issue resolved')
      );
      IssueListCacheStore.reset();
      invalidateInboxQueries();
      void queryClient.invalidateQueries({
        queryKey: groupQueryKey({
          organizationSlug: organization.slug,
          groupId: group.id,
        }),
      });
    } catch {
      // GroupStore already shows the error
    }
  }

  return (
    <GroupResolutionActions
      disabled={disabled}
      event={null}
      group={group}
      onUpdate={handleUpdate}
      project={project}
      variant={variant}
    />
  );
}

export function IssuePreviewHeaderActions({
  disabled = false,
  group,
  onContinueInSeer,
  onRetryCodeChanges,
  project,
}: IssuePreviewHeaderActionsProps) {
  const {state} = useIssuePreviewSeer();
  const shouldShowSeerActions = state === 'start' || state === 'summary';

  if (
    group.derivedData?.progress === ProgressState.FIX_APPLIED &&
    getConfigForIssueType(group, project).actions.resolve.enabled
  ) {
    return (
      <IssuePreviewResolutionActions
        disabled={disabled}
        group={group}
        project={project}
      />
    );
  }

  if (state === 'loading') {
    return <Placeholder width="120px" height="32px" />;
  }

  if (!shouldShowSeerActions) {
    return <IssuePreviewActions group={group} project={project} disabled={disabled} />;
  }

  return (
    <Flex align="center" gap="sm" wrap="wrap">
      <IssuePreviewSeerActions
        disabled={disabled}
        group={group}
        onContinueInSeer={onContinueInSeer}
        onRetryCodeChanges={onRetryCodeChanges}
      />
      <IssuePreviewResolutionActions
        disabled={disabled}
        group={group}
        project={project}
        variant="secondary"
      />
    </Flex>
  );
}
