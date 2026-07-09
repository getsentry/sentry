import {TeamAvatar, UserAvatar} from '@sentry/scraps/avatar';

import type {Team} from 'sentry/types/organization';
import type {AvatarUser} from 'sentry/types/user';

import {InlineChip} from './inlineChip';

function isTeam(value: AvatarUser | Team): value is Team {
  return 'slug' in value;
}

export function AssigneePill({assignee}: {assignee: AvatarUser | string | Team}) {
  if (typeof assignee === 'string') {
    return <InlineChip variant="constrained">{assignee}</InlineChip>;
  }

  if (isTeam(assignee)) {
    return (
      <InlineChip variant="constrainedCompactLeading">
        <TeamAvatar team={assignee} size={16} hasTooltip={false} />#{assignee.slug}
      </InlineChip>
    );
  }

  return (
    <InlineChip variant="constrainedCompactLeading">
      <UserAvatar user={assignee} size={16} />
      {assignee.name || assignee.email || assignee.username}
    </InlineChip>
  );
}
