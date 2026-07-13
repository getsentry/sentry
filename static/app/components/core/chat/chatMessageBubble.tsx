import styled from '@emotion/styled';

interface ChatMessageBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /**
   * Caps how wide the bubble can grow relative to its container. Defaults to
   * `80%` so a bubble never spans the full conversation width.
   */
  maxWidth?: React.CSSProperties['maxWidth'];
}

/**
 * A single chat message bubble, styled for the sender's own messages in an
 * agent conversation (Seer Explorer, Dashboards AI, Autofix, …).
 *
 * Presentation only — alignment within the conversation is the caller's
 * responsibility (wrap it in a right-aligned row for user messages).
 */
export function ChatMessageBubble({
  children,
  maxWidth = '80%',
  ...props
}: ChatMessageBubbleProps) {
  return (
    <Bubble maxWidth={maxWidth} {...props}>
      {children}
    </Bubble>
  );
}

const Bubble = styled('div')<{maxWidth: React.CSSProperties['maxWidth']}>`
  max-width: ${p => p.maxWidth};
  min-width: 0;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  color: ${p => p.theme.tokens.content.primary};
  background: ${p => p.theme.tokens.background.secondary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
`;
