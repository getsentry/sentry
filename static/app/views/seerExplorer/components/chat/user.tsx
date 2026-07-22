import {MessageRow, UserMessage} from '@sentry/scraps/chat';

import type {UserBlockProps} from './shared';

export function UserBlock({block}: UserBlockProps) {
  return (
    <MessageRow from="user">
      <UserMessage>{block.message.content ?? ''}</UserMessage>
    </MessageRow>
  );
}
