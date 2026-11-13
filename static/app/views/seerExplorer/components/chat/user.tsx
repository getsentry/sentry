import {Fragment} from 'react';

import {MessageRow, UserMessage} from '@sentry/scraps/chat';

import {isPrIterationBlock} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  FeedbackList,
  parseFeedback,
} from 'sentry/components/events/autofix/v3/feedbackList';
import {getBlockChatPrompt} from 'sentry/views/seerExplorer/chatPrompt';

import {ChatPromptMessage} from './chatPrompt';
import type {UserBlockProps} from './shared';

export function UserBlock({block}: UserBlockProps) {
  if (isPrIterationBlock(block)) {
    return <PrFeedbackNotice block={block} />;
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

function PrFeedbackNotice({block}: UserBlockProps) {
  const metadata = block.message.metadata;
  const items = metadata?.feedback
    ? parseFeedback(metadata.feedback).map(item => ({
        ...item,
        timestamp: undefined,
      }))
    : [];
  return (
    <MessageRow from="assistant" density="compact" data-test-id="pr-feedback-notice">
      <FeedbackList items={items} />
    </MessageRow>
  );
}
