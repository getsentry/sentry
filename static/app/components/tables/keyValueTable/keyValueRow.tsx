import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';

import {RevealOnHover} from '@sentry/scraps/revealOnHover';

/**
 * - `code`: mono, secondary-color keys, for identifiers like tag and context keys.
 * - `label`: sans, medium-weight, primary-color keys in roomier rows, for prose
 *   labels like "Duration Impact".
 */
export type KeyValueTableVariant = 'code' | 'label';

type KeyValueRowTone = 'danger' | 'warning';

interface KeyValueRowProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: KeyValueRowTone;
  variant?: KeyValueTableVariant;
}

export function KeyValueRow({tone, variant = 'code', ...props}: KeyValueRowProps) {
  return (
    <RevealOnHover>
      {revealOnHoverProps => (
        <Row tone={tone} variant={variant} {...mergeProps(props, revealOnHoverProps)} />
      )}
    </RevealOnHover>
  );
}

const toneStyles = ({theme, tone}: {theme: Theme; tone?: KeyValueRowTone}) => {
  const [content, tint] =
    tone === 'danger'
      ? [theme.colors.red500, theme.colors.red100]
      : tone === 'warning'
        ? [
            theme.tokens.content.warning,
            theme.tokens.background.transparent.warning.muted,
          ]
        : [theme.tokens.content.secondary, null];

  return css`
    color: ${content};
    box-shadow: inset 0 0 0 1px ${tint ?? 'transparent'};
    background-color: ${tint ?? theme.tokens.background.primary};
    &:nth-child(odd) {
      background-color: ${tint ?? theme.tokens.background.secondary};
    }
  `;
};

const Row = styled('div')<{variant: KeyValueTableVariant; tone?: KeyValueRowTone}>`
  position: relative;
  display: grid;
  grid-template-columns: subgrid;
  grid-column: span 2;
  column-gap: ${p => p.theme.space.lg};
  padding: ${p => (p.variant === 'label' ? p.theme.space.sm : p.theme.space['2xs'])}
    ${p => p.theme.space.sm};
  border-radius: 4px;
  ${toneStyles};

  &:focus-within {
    z-index: 1;
  }
`;
