import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

type Size = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<Size, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 24,
};

interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Diameter of the spinner. Matches the icon size scale.
   */
  size?: Size;
}

/**
 * A small, inline activity spinner for chat and agent surfaces — used next to a
 * message that is streaming or a tool call that is still running.
 *
 * Scoped to the chat primitives — the general spinner/loading consolidation is
 * tracked separately.
 *
 * Decorative by default (`aria-hidden`). Pass an `aria-label` (and typically
 * `role="status"`) when the spinner is the only signal that work is in progress.
 */
export function Spinner({size = 'xs', ...props}: SpinnerProps) {
  return (
    <Ring
      $size={SIZES[size]}
      aria-hidden={!props['aria-label'] && !props.role ? true : undefined}
      {...props}
    />
  );
}

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

const Ring = styled('span')<{$size: number}>`
  box-sizing: border-box;
  display: inline-block;
  width: ${p => p.$size}px;
  height: ${p => p.$size}px;
  border-radius: ${p => p.theme.radius.full};
  border: 1.5px solid ${p => p.theme.tokens.border.primary};
  border-left-color: ${p => p.theme.tokens.border.accent.vibrant};
  animation: ${spin} 0.6s linear infinite;
  flex-shrink: 0;

  @media (prefers-reduced-motion: reduce) {
    animation-duration: 2.4s;
  }
`;
