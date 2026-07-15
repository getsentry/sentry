import {MessageRow, UserBubble} from '@sentry/scraps/chat';

import type {UserBlockProps} from './shared';

export function UserBlock({block}: UserBlockProps) {
  return (
    <MessageRow justify="end" padding="xl">
      <UserBubble>{block.message.content ?? ''}</UserBubble>
    </MessageRow>
  );
}
