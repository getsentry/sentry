import styled from '@emotion/styled';

import {AssigneeBadge} from 'sentry/components/assigneeBadge';
import AssigneeSelectorDropdown, {
  type AssignableEntity,
} from 'sentry/components/assigneeSelectorDropdown';
import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {User} from 'sentry/types/user';

interface AssigneeSelectorProps {
  assigneeLoading: boolean;
  group: Group;
  handleAssigneeChange: (assignedActor: AssignableEntity | null) => void;
  memberList?: User[];
}

export function AssigneeSelector({
  group,
  memberList,
  assigneeLoading,
  handleAssigneeChange,
}: AssigneeSelectorProps) {
  return (
    <AssigneeSelectorDropdown
      group={group}
      loading={assigneeLoading}
      memberList={memberList}
      onAssign={(assignedActor: AssignableEntity | null) =>
        handleAssigneeChange(assignedActor)
      }
      onClear={() => handleAssigneeChange(null)}
      trigger={(props, isOpen) => (
        <StyledDropdownButton
          {...props}
          borderless
          aria-label={t('Modify issue assignee')}
          size="zero"
        >
          <AssigneeBadge
            assignedTo={group.assignedTo ?? undefined}
            assignmentReason={
              group.owners?.find(owner => {
                const [_ownershipType, ownerId] = owner.owner.split(':');
                return ownerId === group.assignedTo?.id;
              })?.type
            }
            loading={assigneeLoading}
            chevronDirection={isOpen ? 'up' : 'down'}
          />
        </StyledDropdownButton>
      )}
    />
  );
}

const StyledDropdownButton = styled(Button)`
  font-weight: ${p => p.theme.fontWeightNormal};
  border: none;
  padding: 0;
  height: unset;
  border-radius: 10px;
  box-shadow: none;
`;
