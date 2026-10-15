import {ActorAvatar} from '@sentry/scraps/avatar';
import {Tooltip} from '@sentry/scraps/tooltip';

import {AssignedTooltip, UnassignedTooltip} from 'sentry/components/assigneeBadge';
import {Placeholder} from 'sentry/components/placeholder';
import type {Actor} from 'sentry/types/core';

const AVATAR_SIZE = 24;

/**
 * Read-only counterpart to `<AssigneeSelector>`: shows who an issue is assigned
 * to and offers no way to change it. For issue rows that are a summary rather
 * than a work surface, such as Seer's issue embeds.
 */
export function AssigneeAvatar({assignedTo}: {assignedTo: Actor | null}) {
  if (!assignedTo) {
    return (
      <Tooltip title={<UnassignedTooltip />} skipWrapper>
        <Placeholder
          shape="circle"
          testId="unassigned-avatar"
          width={`${AVATAR_SIZE}px`}
          height={`${AVATAR_SIZE}px`}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={<AssignedTooltip assignedTo={assignedTo} />} skipWrapper>
      <ActorAvatar
        actor={assignedTo}
        size={AVATAR_SIZE}
        hasTooltip={false}
        data-test-id="assigned-avatar"
      />
    </Tooltip>
  );
}
