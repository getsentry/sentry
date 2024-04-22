/* eslint-disable @typescript-eslint/no-unused-vars */
import {useState} from 'react';

import {CompactSelect} from 'sentry/components/compactSelect';
import IdBadge from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import MemberListStore from 'sentry/stores/memberListStore';
import type {
  Actor,
  Group,
  SuggestedOwner,
  SuggestedOwnerReason,
  Team,
  User,
} from 'sentry/types';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';

export type OnAssignCallback = (
  type: Actor['type'],
  assignee: User | Actor,
  suggestedAssignee?: SuggestedAssignee
) => void;

export type SuggestedAssignee = Actor & {
  assignee: AssignableTeam | User;
  suggestedReason: SuggestedOwnerReason;
  suggestedReasonText?: React.ReactNode;
};

type AssignableTeam = {
  display: string;
  email: string;
  id: string;
  team: Team;
};

export interface NewAssigneeSelectorDropdownProps {
  // children: (props: RenderProps) => React.ReactNode;
  id: string;
  // organization: Organization;
  // alignMenu?: 'left' | 'right' | undefined;
  // assignedTo?: Actor | null;
  // disabled?: boolean;
  group?: Group | FeedbackIssue;
  memberList?: User[];
  // onAssign?: OnAssignCallback;
  // onClear?: () => void;
  owners?: Omit<SuggestedAssignee, 'assignee'>[];
}

type AssigneeDropdownState = {
  loading: boolean;
  // How to handle state?
  assignedTo?: Actor | null | undefined;
  memberList?: User[];
  suggestedOwners?: SuggestedOwner[] | null;
};

function NewAssigneeSelectorDropdown({
  id,
  group,
  memberList,
  owners,
}: NewAssigneeSelectorDropdownProps) {
  const [state, setState] = useState<AssigneeDropdownState>(() => {
    const stateGroup = GroupStore.get(id);
    const stateAssignedTo = stateGroup?.assignedTo;
    const stateLoading = GroupStore.hasStatus(id, 'assignTo');
    const stateMemberList = MemberListStore.state.loading
      ? undefined
      : MemberListStore.getAll();
    const stateSuggestedOwners = stateGroup?.owners;

    return {
      assignedTo: stateAssignedTo,
      loading: stateLoading,
      memberList: stateMemberList,
      suggestedOwners: stateSuggestedOwners,
    };
  });

  const makeMemberOption = (member: User) => ({
    label: (
      <IdBadge
        actor={{
          id: member.id,
          name: member.name,
          type: 'user',
        }}
        // avatarSize={18}
      />
    ),
    value: member.id,
  });

  return (
    <CompactSelect
      multiple
      searchable
      loading
      closeOnSelect
      menuTitle={t('Select Assignee')}
      options={memberList?.map(makeMemberOption) ?? []}
    />
  );
}

// const StyledIdBadge = styled(IdBadge)`
//   overflow: hidden;
//   white-space: nowrap;
//   flex-shrink: 1;
// `;

export default NewAssigneeSelectorDropdown;
