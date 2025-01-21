import styled from '@emotion/styled';

import {assignToActor, clearAssignment} from 'sentry/actionCreators/group';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {AssigneeBadge} from 'sentry/components/assigneeBadge';
import AssigneeSelectorDropdown, {
  type AssignableEntity,
  type SuggestedAssignee,
} from 'sentry/components/assigneeSelectorDropdown';
import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import type {Actor} from 'sentry/types/core';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {useMutation} from 'sentry/utils/queryClient';

interface AssigneeSelectorProps {
  assigneeLoading: boolean;
  group: Group;
  handleAssigneeChange: (assignedActor: AssignableEntity | null) => void;
  additionalMenuFooterItems?: React.ReactNode;
  memberList?: User[];
  owners?: Omit<SuggestedAssignee, 'assignee'>[];
}

export type OnAssignCallback = (
  type: Actor['type'],
  assignee: User | Actor,
  suggestedAssignee?: SuggestedAssignee
) => void;

export function useHandleAssigneeChange({
  organization,
  group,
  onAssign,
  onSuccess,
}: {
  group: Group;
  organization: Organization;
  onAssign?: OnAssignCallback;
  onSuccess?: (assignedTo: Group['assignedTo']) => void;
}) {
  const {mutate: handleAssigneeChange, isPending: assigneeLoading} = useMutation({
    mutationFn: (newAssignee: AssignableEntity | null): Promise<Group> => {
      if (newAssignee) {
        return assignToActor({
          id: group.id,
          orgSlug: organization.slug,
          actor: {id: newAssignee.id, type: newAssignee.type},
          assignedBy: 'assignee_selector',
        });
      }

      return clearAssignment(group.id, organization.slug, 'assignee_selector');
    },
    onSuccess: (updatedGroup, newAssignee) => {
      if (onAssign && newAssignee) {
        onAssign(newAssignee.type, newAssignee.assignee, newAssignee.suggestedAssignee);
      }
      onSuccess?.(updatedGroup.assignedTo);
    },
    onError: () => {
      addErrorMessage('Failed to update assignee');
    },
  });

  return {handleAssigneeChange, assigneeLoading};
}

/**
 * Assignee selector used on issue details + issue stream. Uses `AssigneeSelectorDropdown` which controls most of the logic while this is primarily responsible for the design.
 */
export function AssigneeSelector({
  group,
  memberList,
  assigneeLoading,
  handleAssigneeChange,
  owners,
  additionalMenuFooterItems,
}: AssigneeSelectorProps) {
  return (
    <AssigneeSelectorDropdown
      group={group}
      loading={assigneeLoading}
      memberList={memberList}
      owners={owners}
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
      additionalMenuFooterItems={additionalMenuFooterItems}
    />
  );
}

const StyledDropdownButton = styled(Button)`
  font-weight: ${p => p.theme.fontWeightNormal};
  border: none;
  padding: 0;
  height: unset;
  border-radius: 20px;
  box-shadow: none;
`;
