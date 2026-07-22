import {Container} from '@sentry/scraps/layout';

interface AssistantMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * The content region for an agent's response in a conversation.
 *
 * Unlike the sender's messages (see `UserBubble`), an agent response is not
 * bubbled — it renders as full-width left-aligned content so rich output
 * (markdown, tables, code) reads naturally. It keeps wide content from forcing
 * the row wider; the turn's gutter is owned by the wrapping `MessageRow`.
 */
export function AssistantMessage({children, ...props}: AssistantMessageProps) {
  return (
    <Container width="100%" minWidth={0} overflow="hidden" {...props}>
      {children}
    </Container>
  );
}
