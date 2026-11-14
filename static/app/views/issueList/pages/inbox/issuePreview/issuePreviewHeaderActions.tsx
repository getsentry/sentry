import {useQueryClient} from '@tanstack/react-query';
import type {LocationDescriptor} from 'history';
import {parseAsString, useQueryStates} from 'nuqs';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {toast} from '@sentry/scraps/toast';

import {bulkUpdate} from 'sentry/actionCreators/group';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {IssueListCacheStore} from 'sentry/stores/IssueListCacheStore';
import type {Event} from 'sentry/types/event';
import {GroupStatus, type Group, type GroupStatusResolution} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {getAnalyicsDataForProject} from 'sentry/utils/projects';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {GroupResolutionActions} from 'sentry/views/issueDetails/actions/index';
import {groupQueryKey} from 'sentry/views/issueDetails/useGroup';
import {useInvalidateInboxQueries} from 'sentry/views/issueList/pages/inbox/useInvalidateInboxQueries';

import {IssuePreviewActions} from './issuePreviewActions';
import {isAwaitingResolution, useIssuePreviewSeer} from './issuePreviewSeer';
import {IssuePreviewSeerActions} from './issuePreviewSeerActions';
import type {IssueSummary} from './issuePreviewSummary';

interface IssuePreviewHeaderActionsProps {
  event: Event | undefined;
  group: Group;
  isEventLoading: boolean;
  onContinueInSeer: () => void;
  onRetryCodeChanges: () => void;
  project: Project;
  disabled?: boolean;
  summary?: IssueSummary;
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
  const [{alert_date, alert_rule_id, alert_type}] = useQueryStates({
    alert_date: parseAsString,
    alert_rule_id: parseAsString,
    alert_type: parseAsString,
  });
  const queryClient = useQueryClient();
  const invalidateInboxQueries = useInvalidateInboxQueries(group.id);
  async function handleUpdate(data: GroupStatusResolution) {
    trackAnalytics('issue_inbox.resolve_clicked', {
      organization,
      action_type: data.status,
      action_substatus: data.substatus ?? undefined,
      action_status_details: Object.keys(data.statusDetails || {})[0],
      alert_date: alert_date === null ? undefined : getUtcDateString(Number(alert_date)),
      alert_rule_id: alert_rule_id ?? undefined,
      alert_type: alert_type ?? undefined,
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
      toast.dismiss();
      toast.success(
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
  event,
  group,
  isEventLoading,
  onContinueInSeer,
  onRetryCodeChanges,
  project,
  summary,
}: IssuePreviewHeaderActionsProps) {
  const {autofix, creditCheck, state} = useIssuePreviewSeer();
  const shouldShowSeerActions = state === 'start' || state === 'summary';

  if (isAwaitingResolution(group, project)) {
    return (
      <IssuePreviewResolutionActions
        disabled={disabled}
        group={group}
        project={project}
      />
    );
  }

  if (state === 'loading' || creditCheck.isPending) {
    return <Placeholder width="120px" height="32px" />;
  }

  if (!shouldShowSeerActions) {
    return (
      <IssuePreviewActions
        group={group}
        event={event}
        isEventLoading={isEventLoading}
        summary={summary}
        project={project}
        disabled={disabled}
        autofixData={autofix.runState}
        autofixFormatted={autofix.autofixFormatted}
      />
    );
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
