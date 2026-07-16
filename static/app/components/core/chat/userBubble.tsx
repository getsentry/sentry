import {css} from '@emotion/react';

import {Container} from '@sentry/scraps/layout';

interface UserBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /**
   * Caps how wide the bubble can grow relative to its container. Defaults to
   * `80%` so a bubble never spans the full conversation width.
   */
  maxWidth?: React.CSSProperties['maxWidth'];
}

/**
 * A single chat message bubble, styled for the sender's own messages in an
 * agent conversation.
 *
 * Presentation only — alignment within the conversation is the caller's
 * responsibility (wrap it in a right-aligned row for user messages).
 */
export function UserBubble({children, maxWidth = '80%', ...props}: UserBubbleProps) {
  return (
    <Container
      maxWidth={maxWidth}
      minWidth={0}
      padding="xs md"
      background="secondary"
      border="primary"
      radius="md"
      whiteSpace="pre-wrap"
      // `overflow-wrap`/`word-wrap` are not layout props; they keep long
      // unbroken tokens (URLs, stack frames) from overflowing the bubble.
      css={theme => css`
        color: ${theme.tokens.content.primary};
        word-wrap: break-word;
        overflow-wrap: anywhere;
      `}
      {...props}
    >
      {children}
    </Container>
  );
}
