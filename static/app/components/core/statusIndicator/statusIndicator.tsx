import {keyframes, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

import {unreachable} from 'sentry/utils/unreachable';

type StatusIndicatorVariant =
  | 'accent'
  | 'danger'
  | 'warning'
  | 'success'
  | 'promotion'
  | 'muted';

interface StatusIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: StatusIndicatorVariant;
}

/**
 * A small dot indicator that communicates status or state via color.
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
): {dot: string; pulse: string} {
  switch (variant) {
    case 'accent':
      return {
        dot: theme.tokens.background.accent.vibrant,
        pulse: theme.tokens.background.transparent.accent.muted,
      };
    case 'danger':
      return {
        dot: theme.tokens.background.danger.vibrant,
        pulse: theme.tokens.background.transparent.danger.muted,
      };
    case 'warning':
      return {
        dot: theme.tokens.background.warning.vibrant,
        pulse: theme.tokens.background.transparent.warning.muted,
      };
    case 'success':
      return {
        dot: theme.tokens.background.success.vibrant,
        pulse: theme.tokens.background.transparent.success.muted,
      };
    case 'promotion':
      return {
        dot: theme.tokens.background.promotion.vibrant,
        pulse: theme.tokens.background.transparent.promotion.muted,
      };
    case 'muted':
      return {
        dot: theme.tokens.graphics.neutral.moderate,
        pulse: theme.tokens.background.transparent.neutral.muted,
      };
    default:
      unreachable(variant);
      throw new TypeError(`Unsupported StatusIndicator variant: ${variant}`);
  }
}

const gentlePulse = keyframes`
  0%, 100% {
    transform: scale(1);
  }
  33% {
    transform: scale(0.95);
  }
  67% {
    transform: scale(1.05);
  }
`;

const gentleSpin = keyframes`
  0% {
    opacity: 0;
    border-radius: 6px;
    transform: scale(0.9) rotate(0);
  }
  75% {
    opacity: 1;
    border-radius: 3px;
    transform: scale(1) rotate(1turn);
  }
  100% {
    opacity: 0;
    border-radius: 3px;
    transform: scale(1.25) rotate(1turn);
  }
`;

const Dot = styled('span')<{variant: StatusIndicatorVariant}>`
  position: relative;
  width: 8px;
  height: 8px;
  &::before {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    width: 12px;
    height: 12px;
    border-radius: ${p => p.theme.radius['2xs']};
    background-color: ${p => getDotTokens(p.variant, p.theme).pulse};
    animation: ${gentleSpin} 2.2s cubic-bezier(0.785, 0.135, 0.15, 0.86) infinite;
  }
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 8px;
    height: 8px;
    border-radius: ${p => p.theme.radius.xs};
    background-color: ${p => getDotTokens(p.variant, p.theme).dot};
    animation: ${gentlePulse} 2.2s cubic-bezier(0.445, 0.05, 0.55, 0.95) infinite;
  }
`;
