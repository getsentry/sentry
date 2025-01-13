import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import type {BaseAvatarProps} from 'sentry/components/avatar/baseAvatar';
import type {Actor} from 'sentry/types/core';

interface Props
  extends BaseAvatarProps,
    Omit<React.ComponentProps<typeof ActorAvatar>, 'actor' | 'hasTooltip'> {
  owners: Actor[];
  reverse?: boolean;
}

// Constrain the number of visible suggestions
const MAX_SUGGESTIONS = 3;

function SuggestedAvatarStack({
  owners,
  tooltip,
  tooltipOptions,
  reverse = true,
  suggested = true,
  ...props
}: Props) {
  const [firstSuggestion, ...suggestedOwners] = owners;
  const numAvatars = Math.min(owners.length, MAX_SUGGESTIONS);
  return (
    <AvatarStack reverse={reverse} data-test-id="suggested-avatar-stack">
      {suggestedOwners.slice(0, numAvatars - 1).map((owner, i) => (
        <Avatar
          round={firstSuggestion!.type === 'user'}
          actor={owner}
          hasTooltip={false}
          {...props}
          key={i}
          index={i}
          reverse={reverse}
          suggested={suggested}
        />
      ))}
      <Avatar
        actor={firstSuggestion!}
        tooltip={tooltip}
        tooltipOptions={{...tooltipOptions, skipWrapper: true}}
        {...props}
        index={numAvatars - 1}
        reverse={reverse}
        suggested={suggested}
      />
    </AvatarStack>
  );
}

const AvatarStack = styled('div')<{reverse: boolean}>`
  display: flex;
  align-content: center;
  ${p => p.reverse && `flex-direction: row-reverse;`}
`;

const translateStyles = (props: {index: number; reverse: boolean}) => css`
  transform: translateX(${props.reverse ? 60 * props.index : 60 * -props.index}%);
`;

const Avatar = styled(ActorAvatar)<{index: number; reverse: boolean}>`
  ${translateStyles}
`;

export default SuggestedAvatarStack;
