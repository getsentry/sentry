import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {Tooltip} from 'sentry/components/tooltip';
import {IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

interface IssueAssigneeProps {
  groupId: string;
}

export function IssueAssignee({groupId}: IssueAssigneeProps) {
  const groups = useLegacyStore(GroupStore);
  const group = groups.find(item => item.id === groupId);
  const assignedTo = group?.assignedTo;

  if (assignedTo) {
    return (
      <ActorContainer>
        <ActorAvatar
          actor={assignedTo}
          className="avatar"
          size={22}
          tooltip={t(
            'Assigned to %s',
            assignedTo.type === 'team' ? `#${assignedTo.name}` : assignedTo.name
          )}
        />
      </ActorContainer>
    );
  }

  return (
    <UnassignedContainer>
      <Tooltip isHoverable skipWrapper title={t('Unassigned')}>
        <IconUser size="md" color="gray400" aria-label={t('Unassigned')} />
      </Tooltip>
    </UnassignedContainer>
  );
}

const ActorContainer = styled('div')`
  display: flex;
  justify-content: left;
  padding-left: 18px;
  align-items: center;
  height: 22px;
`;

const UnassignedContainer = styled('div')`
  display: flex;
  justify-content: left;
  padding-left: 20px;
  align-items: center;
  height: 22px;
`;
