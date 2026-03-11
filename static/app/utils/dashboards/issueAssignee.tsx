import {useCallback} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {
  AssigneeSelector,
  useHandleAssigneeChange,
} from 'sentry/components/group/assigneeSelector';
import MemberListStore from 'sentry/stores/memberListStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Group} from 'sentry/types/group';
import {setApiQueryData} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {makeFetchGroupQueryKey, useGroup} from 'sentry/views/issueDetails/useGroup';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

interface IssueAssigneeProps {
  groupId: string;
}

export function IssueAssignee({groupId}: IssueAssigneeProps) {
  const organization = useOrganization();
  const environments = useEnvironmentsFromUrl();
  const queryClient = useQueryClient();
  const {data: group} = useGroup({groupId});
  const memberListState = useLegacyStore(MemberListStore);

  // Update useGroup() query cache
  const onSuccess = useCallback(
    (assignedTo: Group['assignedTo']) => {
      setApiQueryData<Group>(
        queryClient,
        makeFetchGroupQueryKey({
          organizationSlug: organization.slug,
          groupId,
          environments,
        }),
        prev => (prev ? {...prev, assignedTo} : prev)
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
      memberList={memberListState.members}
      assigneeLoading={assigneeLoading}
      handleAssigneeChange={handleAssigneeChange}
    />
  );
}
