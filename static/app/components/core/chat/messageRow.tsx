import {Flex} from '@sentry/scraps/layout';

/**
 * How much vertical breathing room a row gets:
 * - `default`: a full message turn (user/assistant bubble).
 * - `compact`: sub-turn connective content (tool calls, reasoning) that sits
 *   between bubbles, or a surface that stacks turns directly and would read too
 *   airy at the default spacing.
 */
type MessageRowDensity = 'default' | 'compact';

interface MessageRowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /**
   * Whose turn this is: `user` sits on the right, `assistant` on the left. The
   * row owns the role-to-side mapping so callers express intent, not layout.
   */
  from: 'user' | 'assistant';
  /**
   * The row's vertical breathing room. The row owns the token-to-pixel mapping
   * so callers express intent, not spacing. Defaults to `default`.
   */
  density?: MessageRowDensity;
}

const DENSITY_PADDING = {
  default: 'xl',
  compact: 'md xl',
} as const;

/**
 * The full-width row that positions a single message turn within a conversation.
 *
 * Presentation only — it owns the row's alignment and the consistent gutter
 * around a turn. The bubble or content is the caller's responsibility; lay out
 * multi-part content in your own wrapper.
 */
export function MessageRow({
  children,
  from,
  density = 'default',
  ...props
}: MessageRowProps) {
  return (
    <Flex
      align="start"
      justify={from === 'user' ? 'end' : 'start'}
      width="100%"
      padding={DENSITY_PADDING[density]}
      {...props}
    >
      {children}
    </Flex>
  );
}
