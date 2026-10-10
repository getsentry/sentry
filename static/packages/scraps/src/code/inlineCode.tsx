import {css as emotionCss} from '@emotion/react';
import {css, cx, type LinariaClassName} from '@linaria/core';

import type {Theme} from '@sentry/scraps/theme';

/**
 * Emotion version of the `InlineCode` styles, for styling `<code>` elements a
 * component does not render itself (e.g. markdown output inside `Prose`).
 */
export const inlineCodeStyles = (theme: Theme, props?: InlineCodeProps) => emotionCss`
  /**
   * Reset any properties that might be set by the global CSS styles.
   */
  margin: 0;
  padding: 0;
  border: none;

  font-family: ${theme.font.family.mono};
  /**
   * adjust height of x character to 57% of bounding box
   * to match Rubik's x-height (magic number)
   */
  font-size-adjust: ex-height 0.57;

  color: ${
    props?.variant === 'neutral'
      ? theme.tokens.content.primary
      : theme.tokens.content.promotion
  };
  background: ${
    props?.variant === 'neutral'
      ? theme.tokens.background.transparent.neutral.muted
      : theme.tokens.background.transparent.promotion.muted
  };

  padding-inline: 0.3ch;
  margin-inline: -0.15ch;
  border-radius: ${theme.radius['2xs']};
  /* 3px (2xs) at 14px font-size and 8px (lg) at 24px font */
  border-radius: clamp(0.21em, 0.28em, 0.57em);

  text-box-edge: text text;
  text-box-trim: trim-both;
`;

const styles = {
  root: css`
    margin: 0;
    padding: 0;
    border-style: none;
    font-family: 'Roboto Mono', Monaco, Consolas, 'Courier New', monospace;
    font-size-adjust: ex-height 0.57;
    padding-inline: 0.3ch;
    margin-inline: -0.15ch;
    border-radius: 3px;
    border-radius: clamp(0.21em, 0.28em, 0.57em);
    text-box-edge: text text;
    text-box-trim: trim-both;
  `,
  accent: css`
    color: var(--ln-content-promotion, #c8007e);
    background-color: var(--ln-background-transparentPromotionMuted, #f000901a);
  `,
  neutral: css`
    color: var(--ln-content-primary, #302e36);
    background-color: var(--ln-background-transparentNeutralMuted, #0000200f);
  `,
};

interface InlineCodeProps extends React.HTMLProps<HTMLElementTagNameMap['code']> {
  /** Emotion css is not supported; use an Emotion styled wrapper. */
  css?: never;
  /** Custom styles from Linaria css; Emotion styles are not supported. */
  customCss?: LinariaClassName;
  variant?: 'neutral' | 'accent';
}
export function InlineCode({
  variant,
  customCss,
  className,
  style,
  ...props
}: InlineCodeProps) {
  const sx = {
    className: cx(styles.root, variant === 'neutral' ? styles.neutral : styles.accent),
  };
  return (
    <code {...props} className={cx(sx.className, customCss, className)} style={style} />
  );
}
