import {
  AssigneeSelector,
  useHandleAssigneeChange,
} from 'sentry/components/group/assigneeSelector';
import MemberListStore from 'sentry/stores/memberListStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import useOrganization from 'sentry/utils/useOrganization';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

interface IssueAssigneeProps {
  groupId: string;
}

export function IssueAssignee({groupId}: IssueAssigneeProps) {
  const organization = useOrganization();
  const {data: group} = useGroup({groupId});
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
