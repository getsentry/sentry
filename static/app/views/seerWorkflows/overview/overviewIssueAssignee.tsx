import {useCallback, useMemo} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {
  AssigneeSelector,
  useHandleAssigneeChange,
} from 'sentry/components/group/assigneeSelector';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {Group} from 'sentry/types/group';
import type {User} from 'sentry/types/user';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

interface OverviewIssueAssigneeProps {
  groupId: string;
  projectId: string;
  projectSlug: string;
  assignedTo?: Group['assignedTo'];
  memberList?: User[];
  memberListLoading?: boolean;
  owners?: Group['owners'];
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

  const handleSuccess = useCallback(() => {
    // Refetch the overview so the assignee filter's options and counts pick up
    // the reassignment from the server.
    void queryClient.invalidateQueries({queryKey: [overviewUrl]});
    void queryClient.invalidateQueries({queryKey: [issueIndexUrl]});
  }, [issueIndexUrl, overviewUrl, queryClient]);

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
