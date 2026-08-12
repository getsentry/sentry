import {css} from '@emotion/react';

import {Container} from '@sentry/scraps/layout';

interface UserMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /**
   * Caps how wide the bubble can grow relative to its container. Defaults to
   * `80%` so a bubble never spans the full conversation width.
   */
  maxWidth?: React.CSSProperties['maxWidth'];
  /**
   * How wide the bubble sizes itself. Left unset by default so it hugs its
   * content; pass `100%` to fill up to `maxWidth`, useful for multiline or rich
   * content that reads better in a wider bubble.
   */
  width?: React.CSSProperties['width'];
}

/**
 * A single chat message bubble, styled for the sender's own messages in an
 * agent conversation.
 *
 * Presentation only — alignment within the conversation is the caller's
 * responsibility (wrap it in a right-aligned row for user messages).
 */
export function UserMessage({
  children,
  maxWidth = '80%',
  width,
  ...props
}: UserMessageProps) {
  return (
    <Container
      maxWidth={maxWidth}
      width={width}
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
