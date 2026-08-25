import {useMemo} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {bulkUpdate} from 'sentry/actionCreators/group';
import {addSuccessMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import {ResolveActions} from 'sentry/components/actions/resolve';
import {t} from 'sentry/locale';
import {IssueListCacheStore} from 'sentry/stores/IssueListCacheStore';
import type {Group, GroupStatusResolution} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {getAnalyicsDataForProject} from 'sentry/utils/projects';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {groupQueryKey} from 'sentry/views/issueDetails/useGroup';
import {useProjectReleaseVersionIsSemver} from 'sentry/views/issueDetails/useProjectReleaseVersionIsSemver';

interface IssuePreviewResolveActionsProps {
  disabled: boolean;
  group: Group;
  project: Project;
}

export function IssuePreviewResolveActions({
  disabled,
  group,
  project,
}: IssuePreviewResolveActionsProps) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const location = useLocation();
  const queryClient = useQueryClient();
  const hasRelease = !!project.features?.includes('releases');
  const hasSemverReleaseFeature = useProjectReleaseVersionIsSemver({
    version: project.latestRelease?.version,
    enabled: true,
  });
  const config = useMemo(() => getConfigForIssueType(group, project), [group, project]);
  const {resolve: resolveCap, resolveInRelease: resolveInReleaseCap} = config.actions;

  function handleUpdate(data: GroupStatusResolution) {
    bulkUpdate(
      api,
      {
        orgId: organization.slug,
        projectId: project.slug,
        itemIds: [group.id],
        data,
      },
      {
        complete: () => {
          clearIndicators();
          addSuccessMessage(t('Issue resolved'));
          queryClient.invalidateQueries({
            queryKey: groupQueryKey({
              organizationSlug: organization.slug,
              groupId: group.id,
            }),
          });
        },
      }
    );

    const {alert_date, alert_rule_id, alert_type} = location.query;
    trackAnalytics('issue_details.action_clicked', {
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
    IssueListCacheStore.reset();
  }

  if (!resolveCap.enabled || group.status === 'resolved' || group.status === 'ignored') {
    return null;
  }

  return (
    <ResolveActions
      disableResolveInRelease={!resolveInReleaseCap.enabled}
      disabled={disabled}
      disableDropdown={disabled}
      hasRelease={hasRelease}
      latestRelease={project.latestRelease}
      hasSemverReleaseFeature={hasSemverReleaseFeature}
      onUpdate={handleUpdate}
      project={project}
      size="sm"
      priority="primary"
    />
  );
}
