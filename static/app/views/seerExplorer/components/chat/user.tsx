import {UserBubble} from '@sentry/scraps/chat';
import {Flex} from '@sentry/scraps/layout';

import type {UserBlockProps} from './shared';

export function UserBlock({block}: UserBlockProps) {
  return (
    <Flex align="start" justify="end" width="100%" padding="xl">
      <UserBubble>{block.message.content ?? ''}</UserBubble>
    </Flex>
  );
}
