import {useCallback, useMemo, useState} from 'react';
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
  const [assignedToOverride, setAssignedToOverride] = useState<{
    assignedTo: Group['assignedTo'];
    groupId: OverviewIssueAssigneeProps['groupId'];
  } | null>(null);

  const currentAssignedTo =
    assignedToOverride?.groupId === groupId
      ? assignedToOverride.assignedTo
      : (assignedTo ?? null);

  const group = useMemo(
    () => ({
      id: groupId,
      assignedTo: currentAssignedTo,
      owners,
      project: {
        id: projectId,
        slug: projectSlug,
      },
    }),
    [currentAssignedTo, groupId, owners, projectId, projectSlug]
  );

  const handleSuccess = useCallback(
    (nextAssignedTo: Group['assignedTo']) => {
      setAssignedToOverride({groupId, assignedTo: nextAssignedTo});
      void queryClient.invalidateQueries({queryKey: [issueIndexUrl]});
    },
    [groupId, issueIndexUrl, queryClient]
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
