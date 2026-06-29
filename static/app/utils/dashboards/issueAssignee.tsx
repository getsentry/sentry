import {useCallback, useMemo, useState} from 'react';

import {
  AssigneeSelector,
  useHandleAssigneeChange,
} from 'sentry/components/group/assigneeSelector';
import type {Group} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';

interface IssueAssigneeProps {
  groupId: string;
  projectId: string;
  projectSlug: string;
  assignedTo?: Group['assignedTo'];
  owners?: Group['owners'];
}

export function IssueAssignee({
  groupId,
  projectId,
  projectSlug,
  assignedTo,
  owners,
}: IssueAssigneeProps) {
  const organization = useOrganization();
  const [assignedToOverride, setAssignedToOverride] = useState<{
    assignedTo: Group['assignedTo'];
    groupId: IssueAssigneeProps['groupId'];
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

  const onSuccess = useCallback(
    (nextAssignedTo: Group['assignedTo']) => {
      setAssignedToOverride({groupId, assignedTo: nextAssignedTo});
    },
    [groupId]
  );

  const {handleAssigneeChange, assigneeLoading} = useHandleAssigneeChange({
    group,
    organization,
    onSuccess,
  });

  return (
    <AssigneeSelector
      group={group}
      assigneeLoading={assigneeLoading}
      handleAssigneeChange={handleAssigneeChange}
    />
  );
}
