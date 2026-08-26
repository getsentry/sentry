import styled from '@emotion/styled';

import {ActorAvatar, type ActorAvatarProps} from '@sentry/scraps/avatar';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {Actor} from 'sentry/types/core';

interface SuggestedAvatarStackProps extends Omit<
  ActorAvatarProps,
  'actor' | 'hasTooltip'
> {
  owners: Actor[];
  /**
   * Render owners in their original order when true and reversed when false.
   * The first owner remains visually on top in either direction.
   */
  reverse?: boolean;
}

// Constrain the number of visible suggestions
const MAX_SUGGESTIONS = 3;

export function SuggestedAvatarStack({
  owners,
  tooltip,
  tooltipOptions,
  reverse = true,
  size = 24,
  suggested = true,
  ...props
}: SuggestedAvatarStackProps) {
  const visibleOwners = owners
    .slice(0, MAX_SUGGESTIONS)
    .map((owner, index) => ({index, owner}));
  const orderedOwners = reverse ? visibleOwners : visibleOwners.toReversed();

  if (orderedOwners.length === 0) {
    return null;
  }

  return (
    <Tooltip title={tooltip} {...tooltipOptions} skipWrapper>
      <AvatarStack overlap={size * 0.6} data-test-id="suggested-avatar-stack">
        {orderedOwners.map(({index, owner}) => (
          <Avatar
            actor={owner}
            hasTooltip={false}
            {...props}
            key={`${owner.type}:${owner.id}:${index}`}
            size={size}
            stackOrder={visibleOwners.length - index}
            suggested={suggested}
          />
        ))}
      </AvatarStack>
    </Tooltip>
  );
}

const AvatarStack = styled('div')<{overlap: number}>`
  align-items: center;
  display: inline-flex;

  > * + * {
    margin-inline-start: -${p => p.overlap}px;
  }
`;

const Avatar = styled(ActorAvatar)<{stackOrder: number}>`
  position: relative;
  z-index: ${p => p.stackOrder};
`;
