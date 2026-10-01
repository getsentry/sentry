import {Fragment} from 'react';

import {MessageRow, UserMessage} from '@sentry/scraps/chat';

import {getBlockChatPrompt} from 'sentry/views/seerExplorer/chatPrompt';

import {ChatPromptMessage} from './chatPrompt';
import type {UserBlockProps} from './shared';

export function UserBlock({block}: UserBlockProps) {
  const chatPrompt = getBlockChatPrompt(block);
  return (
    <Fragment>
      {chatPrompt ? <ChatPromptMessage text={chatPrompt.text} /> : null}
      <MessageRow from="user">
        <UserMessage>{block.message.content ?? ''}</UserMessage>
      </MessageRow>
    </Fragment>
  );
}
