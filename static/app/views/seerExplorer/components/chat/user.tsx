import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {useBlockContext} from './shared';

export function UserBlock() {
  const {block} = useBlockContext();
  return (
    <Flex align="start" justify="end" width="100%" padding="xl">
      <UserBubble>{block.message.content ?? ''}</UserBubble>
    </Flex>
  );
}

const UserBubble = styled('div')`
  max-width: 80%;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  min-width: 0;
  color: ${p => p.theme.tokens.content.primary};
  background: ${p => p.theme.tokens.background.secondary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: 6px;
`;
