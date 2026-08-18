import {useCallback, useMemo} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {
  AssigneeSelector,
  useHandleAssigneeChange,
} from 'sentry/components/group/assigneeSelector';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {Group} from 'sentry/types/group';
import type {User} from 'sentry/types/user';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {AutofixOverviewResponse} from './types';

interface OverviewIssueAssigneeProps {
  groupId: string;
  projectId: string;
  projectSlug: string;
  assignedTo?: Group['assignedTo'];
  memberList?: User[];
  memberListLoading?: boolean;
  owners?: Group['owners'];
}

function withRunAssignee(
  response: AutofixOverviewResponse,
  groupId: string,
  assignedTo: Group['assignedTo']
): AutofixOverviewResponse {
  return {
    ...response,
    runsByMilestone: Object.fromEntries(
      Object.entries(response.runsByMilestone).map(([milestone, runs]) => [
        milestone,
        runs.map(run =>
          run.groupId === groupId ? {...run, issue: {...run.issue, assignedTo}} : run
        ),
      ])
    ) as AutofixOverviewResponse['runsByMilestone'],
  };
}

// Intentionally duplicates static/app/utils/dashboards/issueAssignee.tsx for the Autofix Overview POC.
export function OverviewIssueAssignee({
  groupId,
  projectId,
  projectSlug,
  assignedTo,
  memberList,
  memberListLoading = false,
  owners,
}: OverviewIssueAssigneeProps) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const issueIndexUrl = getApiUrl('/organizations/$organizationIdOrSlug/issues/', {
    path: {organizationIdOrSlug: organization.slug},
  });
  const overviewUrl = getApiUrl(
    '/organizations/$organizationIdOrSlug/seer/autofix-overview/',
    {path: {organizationIdOrSlug: organization.slug}}
  );

  const group = useMemo(
    () => ({
      id: groupId,
      assignedTo: assignedTo ?? null,
      owners,
      project: {
        id: projectId,
        slug: projectSlug,
      },
    }),
    [assignedTo, groupId, owners, projectId, projectSlug]
  );

  const handleSuccess = useCallback(
    (nextAssignedTo: Group['assignedTo']) => {
      // Patch the assignee straight into the cached overview so the card and the
      // filter's options/counts update without a full (Snuba-heavy) refetch.
      queryClient.setQueriesData<ApiResponse<AutofixOverviewResponse>>(
        {queryKey: [overviewUrl]},
        previous =>
          previous && {
            ...previous,
            json: withRunAssignee(previous.json, groupId, nextAssignedTo),
          }
      );
      void queryClient.invalidateQueries({queryKey: [issueIndexUrl]});
    },
    [groupId, issueIndexUrl, overviewUrl, queryClient]
  );

  const {handleAssigneeChange, assigneeLoading} = useHandleAssigneeChange({
    group,
    organization,
    onSuccess: handleSuccess,
  });

  if (memberListLoading) {
    return <LoadingIndicator mini relative size={24} />;
  }

  return (
    <AssigneeSelector
      group={group}
      assigneeLoading={assigneeLoading}
      handleAssigneeChange={handleAssigneeChange}
      memberList={memberList}
    />
  );
}
