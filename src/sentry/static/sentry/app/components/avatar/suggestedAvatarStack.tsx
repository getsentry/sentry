import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';

import ActorAvatar from 'app/components/avatar/actorAvatar';
import BaseAvatar from 'app/components/avatar/baseAvatar';
import {Actor} from 'app/types';

type Props = {
  owners: Actor[];
};

// Constrain the number of visible suggestions
const MAX_SUGGESTIONS = 5;

const SuggestedAvatarStack = ({owners, ...props}: Props) => {
  const backgroundAvatarProps = {
    round: owners[0].type === 'user',
    suggested: true,
    ...props,
  };
  const reversedOwners = owners.slice(0, MAX_SUGGESTIONS).reverse();
  return (
    <AvatarStack>
      {reversedOwners.map((owner, id) => {
        if (id === reversedOwners.length - 1) {
          return (
            <StyledAvatar
              key={owner.id}
              actor={owner}
              suggested
              {...props}
              index={id}
              hasTooltip={false}
            />
          );
        } else {
          return (
            <StyledBackgroundAvatar
              key={owner.id}
              {...backgroundAvatarProps}
              type="background"
              index={id}
            />
          );
        }
      })}
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
