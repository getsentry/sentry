import {Container} from '@sentry/scraps/layout';

interface AssistantMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * The content region for an agent's response in a conversation.
 *
 * Unlike the sender's messages (see `UserBubble`), an agent response is not
 * bubbled — it renders as full-width left-aligned content so rich output
 * (markdown, tables, code) reads naturally. This is presentation only: it owns
 * the turn's gutter and keeps wide content from forcing the row wider; the
 * rendered content is the caller's responsibility.
 */
export function AssistantMessage({children, ...props}: AssistantMessageProps) {
  return (
    <Container padding="xl" minWidth={0} overflow="hidden" {...props}>
      {children}
    </Container>
  );
}
