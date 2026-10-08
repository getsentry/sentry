import {css} from '@emotion/react';
import * as stylex from '@stylexjs/stylex';

import type {Theme} from '@sentry/scraps/theme';
import {fontFamily, radius} from '@sentry/scraps/theme/constants.stylex';
import {background, content} from '@sentry/scraps/theme/tokens.stylex';

/**
 * Emotion version of the `InlineCode` styles, for styling `<code>` elements a
 * component does not render itself (e.g. markdown output inside `Prose`).
 */
export const inlineCodeStyles = (theme: Theme, props?: InlineCodeProps) => css`
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

const styles = stylex.create({
  root: {
    // Reset any properties that might be set by the global CSS styles.
    margin: 0,
    padding: 0,
    borderStyle: 'none',

    fontFamily: fontFamily.mono,
    // Adjust height of x character to 57% of bounding box to match Rubik's
    // x-height (magic number)
    fontSizeAdjust: 'ex-height 0.57',

    paddingInline: '0.3ch',
    marginInline: '-0.15ch',
    // 3px (2xs) at 14px font-size and 8px (lg) at 24px font
    borderRadius: stylex.firstThatWorks('clamp(0.21em, 0.28em, 0.57em)', radius['2xs']),

    textBoxEdge: 'text text',
    textBoxTrim: 'trim-both',
  },
  accent: {
    color: content.promotion,
    backgroundColor: background.transparentPromotionMuted,
  },
  neutral: {
    color: content.primary,
    backgroundColor: background.transparentNeutralMuted,
  },
});

interface InlineCodeProps extends React.HTMLProps<HTMLElementTagNameMap['code']> {
  variant?: 'neutral' | 'accent';
}
export function InlineCode({variant, className, style, ...props}: InlineCodeProps) {
  const sx = stylex.props(
    styles.root,
    variant === 'neutral' ? styles.neutral : styles.accent
  );
  return (
    <code
      {...props}
      className={className ? `${sx.className} ${className}` : sx.className}
      style={sx.style ? {...sx.style, ...style} : style}
    />
  );
}
