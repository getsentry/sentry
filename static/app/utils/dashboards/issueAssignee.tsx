import {useCallback} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {
  AssigneeSelector,
  useHandleAssigneeChange,
} from 'sentry/components/group/assigneeSelector';
import type {Group} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';
import {groupApiOptions, useGroup} from 'sentry/views/issueDetails/useGroup';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

interface IssueAssigneeProps {
  groupId: string;
}

export function IssueAssignee({groupId}: IssueAssigneeProps) {
  const organization = useOrganization();
  const environments = useEnvironmentsFromUrl();
  const queryClient = useQueryClient();
  const {data: group} = useGroup({groupId});

  // Update useGroup() query cache
  const onSuccess = useCallback(
    (assignedTo: Group['assignedTo']) => {
      queryClient.setQueryData(
        groupApiOptions({
          organizationSlug: organization.slug,
          groupId,
          environments,
        }).queryKey,
        prev => (prev ? {...prev, json: {...prev.json, assignedTo}} : prev)
      );
    },
    [queryClient, organization.slug, groupId, environments]
  );

  const {handleAssigneeChange, assigneeLoading} = useHandleAssigneeChange({
    group: group!,
    organization,
    onSuccess,
  });

  if (!group) {
    return null;
  }

  return (
    <AssigneeSelector
      group={group}
      assigneeLoading={assigneeLoading}
      handleAssigneeChange={handleAssigneeChange}
    />
  );
}
