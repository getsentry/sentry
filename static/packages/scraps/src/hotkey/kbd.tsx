import {css as emotionCss} from '@emotion/react';
import {css, cx, type LinariaClassName} from '@linaria/core';

import type {Theme} from '@sentry/scraps/theme';

/**
 * Emotion version of the `Kbd` styles, for styling `<kbd>` elements a component
 * does not render itself (e.g. markdown output inside `Prose`).
 */
export const kbdStyles = (theme: Theme, variant?: KbdProps['variant']) => emotionCss`
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

const styles = {
  root: css`
    margin: 0;
    padding: 0 4px;
    height: 1.67em;
    font-family: 'Roboto Mono', Monaco, Consolas, 'Courier New', monospace;
    font-size: 12px;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-width: 1px;
    border-style: solid;
    border-color: var(--ln-border-primary, #dad9de);
    border-radius: 5px;
    box-shadow: none;
  `,
  embossed: css`
    color: var(--ln-content-primary, #302e36);
    background-color: var(--ln-background-primary, #ffffff);
    border-bottom-width: 2px;
  `,
  debossed: css`
    color: var(--ln-content-secondary, #6a6772);
    background-color: var(--ln-background-secondary, #f8f8f9);
    border-top-width: 2px;
  `,
};

interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  /** Emotion css is not supported; use an Emotion styled wrapper. */
  css?: never;
  /** Custom styles from Linaria css; Emotion styles are not supported. */
  customCss?: LinariaClassName;
  variant?: 'embossed' | 'debossed';
}

export function Kbd({variant, customCss, className, style, ...props}: KbdProps) {
  const sx = {
    className: cx(
      styles.root,
      variant === 'debossed' ? styles.debossed : styles.embossed
    ),
  };
  return (
    <kbd {...props} className={cx(sx.className, customCss, className)} style={style} />
  );
}
