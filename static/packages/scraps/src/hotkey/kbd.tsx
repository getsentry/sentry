import {css} from '@emotion/react';
import * as stylex from '@stylexjs/stylex';

import type {Theme} from '@sentry/scraps/theme';
import {
  borderWidth,
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  space,
} from '@sentry/scraps/theme/constants.stylex';
import {background, border, content} from '@sentry/scraps/theme/tokens.stylex';

/**
 * Emotion version of the `Kbd` styles, for styling `<kbd>` elements a component
 * does not render itself (e.g. markdown output inside `Prose`).
 */
export const kbdStyles = (theme: Theme, variant?: KbdProps['variant']) => css`
  margin: 0;
  padding: 0 ${theme.space.xs};
  height: 1.67em; /* 20px */

  font-family: ${theme.font.family.mono};
  font-size: ${theme.font.size.sm};
  font-weight: ${theme.font.weight.sans.medium};

  display: inline-flex;
  align-items: center;
  justify-content: center;

  color: ${
    variant === 'debossed' ? theme.tokens.content.secondary : theme.tokens.content.primary
  };
  background: ${
    variant === 'debossed'
      ? theme.tokens.background.secondary
      : theme.tokens.background.primary
  };
  border: ${theme.border.md} solid ${theme.tokens.border.primary};
  border-top: ${
    variant === 'debossed'
      ? `${theme.border.xl} solid ${theme.tokens.border.primary}`
      : undefined
  };
  border-bottom: ${
    variant === 'debossed'
      ? undefined
      : `${theme.border.xl} solid ${theme.tokens.border.primary}`
  };
  border-radius: ${theme.radius.sm};
  box-shadow: none;
`;

const styles = stylex.create({
  root: {
    margin: 0,
    padding: `0 ${space.xs}`,
    height: '1.67em', // 20px

    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.sansMedium,

    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: borderWidth.md,
    borderStyle: 'solid',
    borderColor: border.primary,
    borderRadius: radius.sm,
    boxShadow: 'none',
  },
  embossed: {
    color: content.primary,
    backgroundColor: background.primary,
    borderBottomWidth: borderWidth.xl,
  },
  debossed: {
    color: content.secondary,
    backgroundColor: background.secondary,
    borderTopWidth: borderWidth.xl,
  },
});

interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  variant?: 'embossed' | 'debossed';
}

export function Kbd({variant, className, style, ...props}: KbdProps) {
  const sx = stylex.props(
    styles.root,
    variant === 'debossed' ? styles.debossed : styles.embossed
  );
  return (
    <kbd
      {...props}
      className={className ? `${sx.className} ${className}` : sx.className}
      style={sx.style ? {...sx.style, ...style} : style}
    />
  );
}
