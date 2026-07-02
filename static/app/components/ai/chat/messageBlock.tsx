import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

/**
 * Presentational message shells shared across AI chat surfaces. They own
 * layout/alignment only; callers pass the rendered content as children. Mirrors
 * Seer Explorer: user bubbles right-aligned, assistant bubbles left-aligned.
 */

/** Max width shared by the user and assistant message bubbles. */
export const AI_MESSAGE_MAX_WIDTH = '80%';

interface MessageBlockProps {
  children: ReactNode;
  className?: string;
  /** Horizontal alignment of the content. Defaults to `start`. */
  justify?: 'start' | 'end';
}

/** Padded, aligned row shell shared by every element in a chat turn. */
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
      <UserBubble expand={expand}>{children}</UserBubble>
    </MessageBlock>
  );
}

const UserBubble = styled('div')<{expand?: boolean}>`
  max-width: ${AI_MESSAGE_MAX_WIDTH};
  width: ${p => (p.expand ? '100%' : 'auto')};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  min-width: 0;
  color: ${p => p.theme.tokens.content.primary};
  background: ${p => p.theme.tokens.background.secondary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: 6px;
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
        <AssistantBubble expand={expand}>{children}</AssistantBubble>
        {meta}
      </Flex>
    </MessageBlock>
  );
}

const AssistantBubble = styled('div')<{expand?: boolean}>`
  max-width: ${AI_MESSAGE_MAX_WIDTH};
  width: ${p => (p.expand ? '100%' : 'auto')};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  word-wrap: break-word;
  overflow-wrap: anywhere;
  min-width: 0;
  color: ${p => p.theme.tokens.content.primary};
  background: ${p => p.theme.tokens.background.transparent.accent.muted};
  border-radius: 6px;
`;
