import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';

/**
 * Presentational message shells shared across AI chat surfaces. They own
 * layout/alignment only; callers pass the rendered content as children. Mirrors
 * Seer Explorer: user bubbles right-aligned, assistant bubbles left-aligned.
 */

/** Max width shared by the user and assistant message bubbles. */
export const AI_MESSAGE_MAX_WIDTH = '800px';

interface MessageBlockProps {
  children: ReactNode;
  className?: string;
  justify?: 'start' | 'end';
}

export function MessageBlock({
  children,
  className,
  justify = 'start',
}: MessageBlockProps) {
  return (
    <Flex
      align="start"
      justify={justify}
      width="100%"
      padding="md xl"
      className={className}
    >
      {children}
    </Flex>
  );
}

interface UserMessageBlockProps {
  children: ReactNode;
  className?: string;
  /** Fill the bubble to its max-width instead of shrinking to fit the content. */
  expand?: boolean;
}

export function UserMessageBlock({children, className, expand}: UserMessageBlockProps) {
  return (
    <MessageBlock justify="end" className={className}>
      <UserBubble
        maxWidth={AI_MESSAGE_MAX_WIDTH}
        width={expand ? '100%' : 'fit-content'}
        minWidth={0}
        padding="md"
        background="secondary"
        border="secondary"
        radius="xs"
        whiteSpace="pre-wrap"
      >
        {children}
      </UserBubble>
    </MessageBlock>
  );
}

const UserBubble = styled(Container)`
  overflow-wrap: anywhere;
`;

interface AssistantMessageBlockProps {
  children: ReactNode;
  className?: string;
  /** Fill the bubble to its max-width instead of shrinking to fit the content. */
  expand?: boolean;
  /** Content rendered to the right of the bubble (e.g. cost/time metadata). */
  meta?: ReactNode;
}

/**
 * Assistant text output as a left-aligned accent bubble mirroring
 * `UserMessageBlock`'s width. Not interactive — tool calls are selected
 * separately by the caller.
 */
export function AssistantMessageBlock({
  children,
  className,
  expand,
  meta,
}: AssistantMessageBlockProps) {
  return (
    <MessageBlock className={className}>
      <Flex justify="between" align="start" gap="md" width="100%">
        <AssistantBubble
          maxWidth={AI_MESSAGE_MAX_WIDTH}
          width={expand ? '100%' : 'fit-content'}
          minWidth={0}
          padding="md"
          radius="xs"
        >
          {children}
        </AssistantBubble>
        {meta}
      </Flex>
    </MessageBlock>
  );
}

const AssistantBubble = styled(Container)`
  overflow-wrap: anywhere;
  background: ${p => p.theme.tokens.background.transparent.accent.muted};
`;
