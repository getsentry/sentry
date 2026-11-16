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

/**
 * Past this length a message wraps in any panel, so its bubble fills the max
 * width anyway. Setting that width explicitly keeps the browser from sizing the
 * bubble from the text's single-line width, which Firefox can't represent for
 * millions of characters: it collapses the bubble to one character per line.
 */
const FILL_WIDTH_MIN_LENGTH = 10_000;

export function UserBlock({block}: UserBlockProps) {
  if (isPrIterationBlock(block)) {
    return <PrFeedbackNotice block={block} />;
  }
  const chatPrompt = getBlockChatPrompt(block);
  const content = block.message.content ?? '';
  return (
    <Fragment>
      {chatPrompt ? <ChatPromptMessage text={chatPrompt.text} /> : null}
      <MessageRow from="user">
        <UserMessage width={content.length > FILL_WIDTH_MIN_LENGTH ? '100%' : undefined}>
          {content}
        </UserMessage>
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
