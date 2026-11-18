import {Fragment, useLayoutEffect, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {tn} from 'sentry/locale';
import {usePrevious} from 'sentry/utils/usePrevious';
import type {AIMessage} from 'sentry/views/insights/pages/agents/utils/aiMessageNormalizer';

/**
 * Collapsing a single message behind a button saves no space, so only
 * collapse when at least this many messages would be hidden.
 */
const MIN_MESSAGES_TO_COLLAPSE = 2;

function isUserTurn(message: AIMessage) {
  if (message.role !== 'user') {
    return false;
  }
  // User messages that only carry tool results (e.g. Anthropic `tool_result`
  // blocks) normalize to an empty string and are not a new turn.
  return !(typeof message.content === 'string' && message.content.trim() === '');
}

/**
 * Splits messages into leading system messages, the messages of previous turns,
 * and the latest turn (the last user message and everything after it).
 */
function getCollapsibleMessageRanges(messages: AIMessage[]): {
  latestTurnStart: number;
  leadingEnd: number;
} {
  let leadingEnd = 0;
  while (leadingEnd < messages.length && messages[leadingEnd]!.role === 'system') {
    leadingEnd++;
  }

  let latestTurnStart = messages.length - 1;
  for (let i = messages.length - 1; i >= leadingEnd; i--) {
    if (isUserTurn(messages[i]!)) {
      latestTurnStart = i;
      break;
    }
  }

  return {leadingEnd, latestTurnStart: Math.max(latestTurnStart, leadingEnd)};
}

/**
 * Renders LLM input messages with previous turns collapsed, so the latest turn
 * is visible without scrolling. Leading system messages stay visible.
 *
 * `children` must contain one rendered node per entry in `messages`.
 */
export function CollapsiblePreviousTurns({
  messages,
  children,
}: {
  children: React.ReactNode[];
  messages: AIMessage[];
}) {
  const {leadingEnd, latestTurnStart} = getCollapsibleMessageRanges(messages);
  const hiddenMessagesCount = latestTurnStart - leadingEnd;
  const shouldCollapse = hiddenMessagesCount >= MIN_MESSAGES_TO_COLLAPSE;

  const [isExpanded, setIsExpanded] = useState(!shouldCollapse);

  const previousMessagesLength = usePrevious(messages.length);
  useLayoutEffect(() => {
    if (previousMessagesLength !== messages.length) {
      // oxlint-disable-next-line react/set-state-in-effect
      setIsExpanded(!shouldCollapse);
    }
  }, [messages.length, previousMessagesLength, shouldCollapse]);

  if (isExpanded) {
    return <Fragment>{children}</Fragment>;
  }

  return (
    <Fragment>
      {children.slice(0, leadingEnd)}
      <Flex
        justify="center"
        align="center"
        height="1px"
        margin="3xl 0"
        borderBottom="primary"
        style={{borderBottomStyle: 'dashed'}}
      >
        <Button onClick={() => setIsExpanded(true)} size="xs">
          {tn(
            'Show %s previous message',
            'Show %s previous messages',
            hiddenMessagesCount
          )}
        </Button>
      </Flex>
      {children.slice(latestTurnStart)}
    </Fragment>
  );
}
