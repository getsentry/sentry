import {Fragment} from 'react';

import {MessageRow, UserMessage} from '@sentry/scraps/chat';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {getBlockChatPrompt} from 'sentry/views/seerExplorer/chatPrompt';

import {ChatPromptMessage} from './chatPrompt';
import type {UserBlockProps} from './shared';

export function UserBlock({block, blockIndex}: UserBlockProps) {
  const chatPrompt = getBlockChatPrompt(block);
  const content = block.message.content ?? '';
  const isAutofixPrompt = blockIndex === 0 && defined(block.message.metadata?.step);
  return (
    <Fragment>
      {chatPrompt ? <ChatPromptMessage text={chatPrompt.text} /> : null}
      <MessageRow from="user">
        <UserMessage>
          {isAutofixPrompt ? (
            <Disclosure size="sm">
              <Disclosure.Title>
                <Text>{t('Started Autofix')}</Text>
              </Disclosure.Title>
              <Disclosure.Content>{content}</Disclosure.Content>
            </Disclosure>
          ) : (
            content
          )}
        </UserMessage>
      </MessageRow>
    </Fragment>
  );
}
