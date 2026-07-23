import type {ReactNode} from 'react';
import {css, useTheme} from '@emotion/react';

import {MessageRow, UserMessage} from '@sentry/scraps/chat';
import {Container, Flex} from '@sentry/scraps/layout';

/**
 * Presentational message bubbles shared across AI chat surfaces. Each wraps the
 * scraps `MessageRow` primitive to own alignment; callers pass the rendered
 * content as children. Mirrors Seer Explorer: user bubbles right-aligned,
 * assistant bubbles left-aligned.
 */

/** Max width shared by the user and assistant message bubbles. */
const AI_MESSAGE_MAX_WIDTH = '800px';

interface UserMessageBlockProps {
  children: ReactNode;
  className?: string;
  /** Fill the bubble to its max-width instead of shrinking to fit the content. */
  expand?: boolean;
}

export function UserMessageBlock({children, className, expand}: UserMessageBlockProps) {
  return (
    <MessageRow from="user" density="compact" className={className}>
      {/* Placeholder for spacing as we want to keep the right aligned look even on smaller screens */}
      <Container paddingLeft="3xl" flexShrink={0} />
      <UserMessage
        maxWidth={AI_MESSAGE_MAX_WIDTH}
        width={expand ? '100%' : 'fit-content'}
      >
        {children}
      </UserMessage>
    </MessageRow>
  );
}

interface AssistantMessageBlockProps {
  children: ReactNode;
  className?: string;
  /** Fill the bubble to its max-width instead of shrinking to fit the content. */
  expand?: boolean;
  /** Whether this message is currently selected. */
  isSelected?: boolean;
  /** Content rendered to the right of the bubble (e.g. cost/time metadata). */
  meta?: ReactNode;
  /** Called when the user clicks the message bubble. */
  onClick?: () => void;
}

/**
 * Assistant text output as a left-aligned accent bubble mirroring
 * `UserMessageBlock`'s width.
 */
export function AssistantMessageBlock({
  children,
  className,
  expand,
  meta,
  isSelected,
  onClick,
}: AssistantMessageBlockProps) {
  const theme = useTheme();

  const bubbleCss = css`
    overflow-wrap: anywhere;
    background: ${theme.tokens.background.transparent.accent.muted};
    ${onClick &&
    css`
      cursor: pointer;
      &:hover {
        opacity: 0.85;
      }
    `}
    ${isSelected &&
    css`
      outline: 2px solid ${theme.tokens.focus.default};
      outline-offset: -2px;
    `}
  `;

  return (
    <MessageRow from="assistant" density="compact" className={className}>
      <Flex justify="between" align="start" gap="md" width="100%">
        <Container
          maxWidth={AI_MESSAGE_MAX_WIDTH}
          width={expand ? '100%' : 'fit-content'}
          minWidth={0}
          padding="md"
          radius="xs"
          css={bubbleCss}
          onClick={onClick}
          role={onClick ? 'button' : undefined}
          tabIndex={onClick ? 0 : undefined}
        >
          {children}
        </Container>
        {meta}
      </Flex>
    </MessageRow>
  );
}
