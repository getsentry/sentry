import styled from '@emotion/styled';

import {assignToActor, clearAssignment} from 'sentry/actionCreators/group';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {AssigneeBadge} from 'sentry/components/assigneeBadge';
import AssigneeSelectorDropdown, {
  type AssignableEntity,
  type SuggestedAssignee,
} from 'sentry/components/assigneeSelectorDropdown';
import {Button} from 'sentry/components/button';
import type {OnAssignCallback} from 'sentry/components/deprecatedAssigneeSelectorDropdown';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';

interface AssigneeSelectorProps {
  assigneeLoading: boolean;
  group: Group;
  handleAssigneeChange: (assignedActor: AssignableEntity | null) => void;
  additionalMenuFooterItems?: React.ReactNode;
  memberList?: User[];
  owners?: Omit<SuggestedAssignee, 'assignee'>[];
}

export function useHandleAssigneeChange({
  organization,
  group,
  onAssign,
}: {
  group: Group;
  organization: Organization;
  onAssign?: OnAssignCallback;
}) {
  const {mutate: handleAssigneeChange, isPending: assigneeLoading} = useMutation<
    AssignableEntity | null,
    RequestError,
    AssignableEntity | null
  >({
    mutationFn: async (
      newAssignee: AssignableEntity | null
    ): Promise<AssignableEntity | null> => {
      if (newAssignee) {
        await assignToActor({
          id: group.id,
          orgSlug: organization.slug,
          actor: {id: newAssignee.id, type: newAssignee.type},
          assignedBy: 'assignee_selector',
        });
        return Promise.resolve(newAssignee);
      }

      await clearAssignment(group.id, organization.slug, 'assignee_selector');
      return Promise.resolve(null);
    },
    onSuccess: (newAssignee: AssignableEntity | null) => {
      if (onAssign && newAssignee) {
        onAssign(newAssignee.type, newAssignee.assignee, newAssignee.suggestedAssignee);
      }
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
