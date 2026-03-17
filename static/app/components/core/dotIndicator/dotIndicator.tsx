import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {unreachable} from 'sentry/utils/unreachable';

type DotIndicatorVariant = 'danger' | 'warning' | 'info';

interface DotIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: DotIndicatorVariant;
}

/**
 * A small circular dot indicator that communicates status or state via color.
 *
 * Accessibility:
 * - Provide `aria-label` when the dot conveys meaningful information not
 *   available elsewhere in the UI. An implicit `role="img"` is added when
 *   `aria-label` is present and no explicit `role` is given.
 * - Omit `aria-label` (and `role`) for purely decorative dots that accompany
 *   visible text; the component will be hidden from the accessibility tree
 *   via `aria-hidden="true"`.
 * - Pass an explicit `role` (e.g. `role="status"`) together with `aria-label`
 *   when a live-region semantic is needed.
 *
 * Placement is the caller's responsibility — no positioning props are provided.
 */
export function DotIndicator({
  'aria-label': ariaLabel,
  role,
  variant,
  ...props
}: DotIndicatorProps) {
  const resolvedRole = role ?? (ariaLabel ? 'img' : undefined);
  const ariaHidden = !ariaLabel && !role ? true : undefined;

  return (
    <StyledDot
      variant={variant}
      role={resolvedRole}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
      {...props}
    />
  );
}

function getDotTokens(
  variant: DotIndicatorVariant,
  theme: Theme
): {background: string; border: string} {
  switch (variant) {
    case 'danger':
      return {
        background: theme.tokens.background.danger.vibrant,
        border: theme.tokens.border.danger.muted,
      };
    case 'warning':
      return {
        background: theme.tokens.background.warning.vibrant,
        border: theme.tokens.border.warning.muted,
      };
    case 'info':
      return {
        background: theme.tokens.background.accent.vibrant,
        border: theme.tokens.border.accent.muted,
      };
    default:
      unreachable(variant);
      throw new TypeError(`Unsupported DotIndicator variant: ${variant}`);
  }
}

const StyledDot = styled('span')<{variant: DotIndicatorVariant}>`
  display: inline-block;
  flex-shrink: 0;
  border-radius: 50%;
  width: 8px;
  height: 8px;
  background-color: ${p => getDotTokens(p.variant, p.theme).background};
  border: 2px solid ${p => getDotTokens(p.variant, p.theme).border};
`;
