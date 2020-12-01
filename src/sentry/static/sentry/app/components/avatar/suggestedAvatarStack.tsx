import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';

import ActorAvatar from 'app/components/avatar/actorAvatar';
import BaseAvatar from 'app/components/avatar/baseAvatar';
import {Actor} from 'app/types';

type Props = {
  owners: Actor[];
} & BaseAvatar['props'] &
  Omit<ActorAvatar['props'], 'actor' | 'hasTooltip'>;

// Constrain the number of visible suggestions
const MAX_SUGGESTIONS = 5;

const SuggestedAvatarStack = ({owners, ...props}: Props) => {
  const backgroundAvatarProps = {
    ...props,
    round: owners[0].type === 'user',
    suggested: true,
  };
  const numAvatars = Math.min(owners.length, MAX_SUGGESTIONS);
  const backgroundAvatars: React.ReactElement[] = [];
  // Generate N - 1 background avatars
  for (let i = 0; i < numAvatars - 1; i++) {
    backgroundAvatars.push(
      <StyledBackgroundAvatar
        {...backgroundAvatarProps}
        key={i}
        type="background"
        index={i}
      />
    );
  }
  return (
    <AvatarStack>
      {backgroundAvatars}
      <StyledAvatar
        {...props}
        suggested
        actor={owners[0]}
        index={numAvatars - 1}
        hasTooltip={false}
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

const StyledAvatar = styled(ActorAvatar)<{index: number}>`
  ${translateStyles}
`;

const StyledBackgroundAvatar = styled(BaseAvatar)<{index: number}>`
  ${translateStyles}
`;

export default SuggestedAvatarStack;
