import {TeamAvatar, UserAvatar} from '@sentry/scraps/avatar';

import type {Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';

import {InlineChip} from './inlineChip';

function isTeam(value: Team | User): value is Team {
  return 'slug' in value;
}

export function AssigneePill({assignee}: {assignee: string | Team | User}) {
  if (typeof assignee === 'string') {
    return <InlineChip>{assignee}</InlineChip>;
  }

  if (isTeam(assignee)) {
    return (
      <InlineChip variant="compactLeading">
        <TeamAvatar team={assignee} size={16} hasTooltip={false} />#{assignee.slug}
      </InlineChip>
    );
  }

  return (
    <InlineChip variant="compactLeading">
      <UserAvatar user={assignee} size={16} />
      {assignee.name || assignee.email || assignee.username}
    </InlineChip>
  );
}
