import {Fragment} from 'react';
import {IconPullRequest} from '@sentry/icons/pullRequest';

import {MessageRow, UserMessage} from '@sentry/scraps/chat';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {getBlockChatPrompt} from 'sentry/views/seerExplorer/chatPrompt';

import {ChatPromptMessage} from './chatPrompt';
import type {UserBlockProps} from './shared';

export function UserBlock({block}: UserBlockProps) {
  if (block.message.metadata?.step === 'pr_iteration') {
    return <PrFeedbackNotice text={block.message.content ?? ''} />;
  }
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

function PrFeedbackNotice({text}: {text: string}) {
  return (
    <MessageRow from="assistant" density="compact" data-test-id="pr-feedback-notice">
      <Flex gap="sm" align="start" minWidth="0">
        <Flex flexShrink={0} paddingTop="2xs">
          <IconPullRequest size="xs" variant="muted" />
        </Flex>
        <Stack gap="xs" minWidth="0">
          {text.split('\n').map((line, index) => (
            <Text key={index} size="sm" variant="muted">
              {line}
            </Text>
          ))}
        </Stack>
      </Flex>
    </MessageRow>
  );
}
