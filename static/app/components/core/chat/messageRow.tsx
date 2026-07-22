import {Flex} from '@sentry/scraps/layout';

interface MessageRowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /**
   * Whose turn this is: `user` sits on the right, `assistant` on the left. The
   * row owns the role-to-side mapping so callers express intent, not layout.
   */
  from: 'user' | 'assistant';
}

/**
 * The full-width row that positions a single message turn within a conversation.
 *
 * Presentation only — it owns the row's alignment and the consistent gutter
 * around a turn. The bubble or content is the caller's responsibility; lay out
 * multi-part content in your own wrapper.
 */
export function MessageRow({children, from, ...props}: MessageRowProps) {
  return (
    <Flex
      align="start"
      justify={from === 'user' ? 'end' : 'start'}
      width="100%"
      padding="xl"
      {...props}
    >
      {children}
    </Flex>
  );
}
