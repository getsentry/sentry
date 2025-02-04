import {
  AssigneeSelector,
  useHandleAssigneeChange,
} from 'sentry/components/group/assigneeSelector';
import GroupStore from 'sentry/stores/groupStore';
import MemberListStore from 'sentry/stores/memberListStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Group} from 'sentry/types/group';
import useOrganization from 'sentry/utils/useOrganization';

interface IssueAssigneeProps {
  groupId: string;
}

export function IssueAssignee({groupId}: IssueAssigneeProps) {
  const organization = useOrganization();
  const groups = useLegacyStore(GroupStore);
  const group = groups.find(item => item.id === groupId) as Group | undefined;
  const memberListState = useLegacyStore(MemberListStore);
  const {handleAssigneeChange, assigneeLoading} = useHandleAssigneeChange({
    group: group!,
    organization,
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
