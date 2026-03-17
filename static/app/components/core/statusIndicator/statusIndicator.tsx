import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

import {unreachable} from 'sentry/utils/unreachable';

type StatusIndicatorVariant = 'danger' | 'warning' | 'info';

interface StatusIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: StatusIndicatorVariant;
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
export function StatusIndicator(props: StatusIndicatorProps) {
  const {variant, ...spanProps} = props;
  return (
    <Container flexShrink={0}>
      {p => (
        <Dot
          {...p}
          {...spanProps}
          variant={variant}
          role={spanProps.role ?? (spanProps['aria-label'] ? 'img' : undefined)}
          aria-hidden={!spanProps['aria-label'] && !spanProps.role ? true : undefined}
        />
      )}
    </Container>
  );
}

function getDotTokens(
  variant: StatusIndicatorVariant,
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
      throw new TypeError(`Unsupported StatusIndicator variant: ${variant}`);
  }
}

const Dot = styled('span')<{variant: StatusIndicatorVariant}>`
  border-radius: 50%;
  width: 10px;
  height: 10px;
  background-color: ${p => getDotTokens(p.variant, p.theme).background};
  border: 2px solid ${p => getDotTokens(p.variant, p.theme).border};
`;
