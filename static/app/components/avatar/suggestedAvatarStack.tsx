import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import BaseAvatar from 'sentry/components/avatar/baseAvatar';
import type {Actor} from 'sentry/types';

type Props = {
  owners: Actor[];
} & BaseAvatar['props'] &
  Omit<React.ComponentProps<typeof ActorAvatar>, 'actor' | 'hasTooltip'>;

// Constrain the number of visible suggestions
const MAX_SUGGESTIONS = 3;

const SuggestedAvatarStack = ({owners, tooltip, tooltipOptions, ...props}: Props) => {
  const [firstSuggestion, ...suggestedOwners] = owners;
  const numAvatars = Math.min(owners.length, MAX_SUGGESTIONS);
  return (
    <AvatarStack data-test-id="suggested-avatar-stack">
      {suggestedOwners.slice(0, numAvatars - 1).map((owner, i) => (
        <Avatar
          {...props}
          suggested
          round={firstSuggestion.type === 'user'}
          actor={owner}
          key={i}
          index={i}
          hasTooltip={false}
        />
      ))}
      <Avatar
        {...props}
        suggested
        actor={firstSuggestion}
        index={numAvatars - 1}
        tooltip={tooltip}
        tooltipOptions={{...tooltipOptions, skipWrapper: true}}
      />
    </AvatarStack>
  );
};

const AvatarStack = styled('div')`
  display: flex;
  align-content: center;
  flex-direction: row-reverse;
`;

const translateStyles = (props: {index: number}) => css`
  transform: translateX(${60 * props.index}%);
`;

const Avatar = styled(ActorAvatar)<{index: number}>`
  ${translateStyles}
`;

export default SuggestedAvatarStack;
