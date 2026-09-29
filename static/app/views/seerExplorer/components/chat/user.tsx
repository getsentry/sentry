import {Fragment} from 'react';

import {MessageRow, UserMessage} from '@sentry/scraps/chat';
import {Markdown} from '@sentry/scraps/markdown';

import {User} from 'sentry/components/seer/markdown/embeds/components/user';

import {getBlockChatPrompt} from 'sentry/views/seerExplorer/chatPrompt';

import {ChatPromptMessage} from './chatPrompt';
import type {UserBlockProps} from './shared';

export function UserBlock({block}: UserBlockProps) {
  const chatPrompt = getBlockChatPrompt(block);
  return (
    <Fragment>
      {chatPrompt ? <ChatPromptMessage text={chatPrompt.text} /> : null}
      <MessageRow from="user">
        <UserMessage>
          <Markdown
            raw={block.message.content ?? ''}
            components={{
              Tag: ({Default, ...props}) =>
                props.name === 'user' ? <User {...props} /> : <Default {...props} />,
            }}
          />
        </UserMessage>
      </MessageRow>
    </Fragment>
  );
}
