import {TeamAvatar, UserAvatar} from '@sentry/scraps/avatar';

import type {Team} from 'sentry/types/organization';

import {InlineChip} from './inlineChip';

export function AssigneePill({
  assignee,
}: {
  assignee: React.ComponentProps<typeof UserAvatar>['user'] | string | Team;
}) {
  if (typeof assignee === 'string') {
    return <InlineChip variant="constrained">{assignee}</InlineChip>;
  }

  if ('slug' in assignee) {
    return (
      <InlineChip variant="constrainedCompactLeading">
        <TeamAvatar team={assignee} size={16} hasTooltip={false} />#{assignee.slug}
      </InlineChip>
    );
  }

  return (
    <InlineChip variant="constrainedCompactLeading">
      <UserAvatar user={assignee} size={16} />
      {assignee.name || assignee.email}
    </InlineChip>
  );
}
