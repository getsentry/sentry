import type {Actor} from 'sentry/types/core';

import BadgeDisplayName from './badgeDisplayName';
import {BaseBadge, type BaseBadgeProps} from './baseBadge';

export interface ActorBadgeProps extends BaseBadgeProps {
  actor: Actor;
}

function ActorBadge({actor, ...props}: ActorBadgeProps) {
  const title = actor.type === 'team' ? `#${actor.name}` : actor.name || actor.email;

  return (
    <BaseBadge
      displayName={<BadgeDisplayName>{title}</BadgeDisplayName>}
      actor={actor}
      {...props}
    />
  );
}

export default ActorBadge;
