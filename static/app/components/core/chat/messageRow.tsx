import {Flex, type FlexProps} from '@sentry/scraps/layout';

interface MessageRowProps extends Omit<FlexProps, 'justify'> {
  children: React.ReactNode;
  /**
   * Which side of the conversation the message sits on: `end` for the sender's
   * own messages, `start` (default) for the agent's responses.
   */
  justify?: 'start' | 'end';
}

/**
 * The full-width row that positions a single message turn within a conversation.
 *
 * Presentation only — it owns alignment and the consistent gutter around a turn;
 * the bubble or content is the caller's responsibility.
 */
export function MessageRow({
  children,
  justify = 'start',
  padding = 'md xl',
  ...props
}: MessageRowProps) {
  return (
    <Flex align="start" justify={justify} width="100%" padding={padding} {...props}>
      {children}
    </Flex>
  );
}
