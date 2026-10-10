import {css} from '@linaria/core';

import {
  addLayoutProp,
  addStyles,
  type LayoutStyle,
} from '@sentry/scraps/layout/linariaLayout';
import type {Responsive} from '@sentry/scraps/layout/styles';
import type {ContentVariant, HeadingSize, TextSize, Theme} from '@sentry/scraps/theme';
import {fontSize, lineHeight} from '@sentry/scraps/theme/constants.linaria';

import type {BaseTextProps} from './text';

/**
 * Props that style text and must not reach the DOM.
 */
export const TEXT_STYLE_PROPS: ReadonlySet<string> = new Set<string>([
  'align',
  'bold',
  'cursor',
  'density',
  'display',
  'ellipsis',
  'fraction',
  'italic',
  'monospace',
  'size',
  'strikethrough',
  'tabular',
  'textWrap',
  'underline',
  'uppercase',
  'variant',
  'wordBreak',
  'wrap',
]);

const styles = {
  reset: css`
    margin: 0;
    padding: 0;
    text-box-edge: text text;
    text-box-trim: trim-both;
  `,
  sans: css`
    font-family: Rubik, 'Avenir Next', sans-serif;
  `,
  mono: css`
    font-family: 'Roboto Mono', Monaco, Consolas, 'Courier New', monospace;
  `,
  italic: css`
    font-style: italic;
  `,
  ellipsis: css`
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  fullWidth: css`
    width: 100%;
  `,
  uppercase: css`
    text-transform: uppercase;
  `,
  inheritFontSize: css`
    font-size: inherit;
  `,
  inheritLineHeight: css`
    line-height: inherit;
  `,
  inheritFontWeight: css`
    font-weight: inherit;
  `,
};

const weights = {
  sansRegular: css`
    font-weight: 400;
  `,
  sansMedium: css`
    font-weight: 500;
  `,
  monoRegular: css`
    font-weight: 425;
  `,
  monoMedium: css`
    font-weight: 500;
  `,
};

const colors = {
  primary: css`
    color: var(--ln-content-primary, #302e36);
  `,
  secondary: css`
    color: var(--ln-content-secondary, #6a6772);
  `,
  accent: css`
    color: var(--ln-content-accent, #653de9);
  `,
  promotion: css`
    color: var(--ln-content-promotion, #c8007e);
  `,
  danger: css`
    color: var(--ln-content-danger, #d50000);
  `,
  warning: css`
    color: var(--ln-content-warning, #a45200);
  `,
  success: css`
    color: var(--ln-content-success, #008900);
  `,
};

const decorations = {
  'line-through': css`
    text-decoration: line-through;
  `,
  underline: css`
    text-decoration: underline;
  `,
  'underline dotted': css`
    text-decoration: underline dotted;
  `,
  'line-through underline': css`
    text-decoration: line-through underline;
  `,
  'line-through underline dotted': css`
    text-decoration: line-through underline dotted;
  `,
};

const numerics = {
  tabular: css`
    font-variant-numeric: tabular-nums;
  `,
  fraction: css`
    font-variant-numeric: diagonal-fractions;
  `,
  both: css`
    font-variant-numeric: tabular-nums diagonal-fractions;
  `,
};

const textWraps = {
  wrap: css`
    text-wrap: wrap;
  `,
  nowrap: css`
    text-wrap: nowrap;
  `,
  balance: css`
    text-wrap: balance;
  `,
  pretty: css`
    text-wrap: pretty;
  `,
  stable: css`
    text-wrap: stable;
  `,
};

const wordBreaks = {
  normal: css`
    word-break: normal;
  `,
  'break-all': css`
    word-break: break-all;
  `,
  'keep-all': css`
    word-break: keep-all;
  `,
  'break-word': css`
    word-break: break-word;
  `,
};

type Density = keyof Theme['font']['lineHeight'];

function getDecorationKey(
  p: Pick<BaseTextProps, 'strikethrough' | 'underline'>
): keyof typeof decorations | undefined {
  const parts: string[] = [];
  if (p.strikethrough) {
    parts.push('line-through');
  }
  if (p.underline) {
    parts.push(p.underline === 'dotted' ? 'underline dotted' : 'underline');
  }
  return parts.length ? (parts.join(' ') as keyof typeof decorations) : undefined;
}

export function getColorStyle(variant: ContentVariant | 'muted' | 'inherit' | undefined) {
  if (variant === 'inherit') {
    return null;
  }
  return colors[variant === 'muted' ? 'secondary' : (variant ?? 'primary')];
}

const FONT_SIZE_OPTIONS = {
  fixed: 'fontSize',
  resolve: (value: TextSize | HeadingSize) => fontSize[value],
};
const DENSITY_OPTIONS = {
  fixed: 'density',
  resolve: (value: Density) => lineHeight[value],
};
const TEXT_ALIGN_OPTIONS = {fixed: 'textAlign'};
const CURSOR_OPTIONS = {fixed: 'cursor'};
const WHITE_SPACE_OPTIONS = {fixed: 'whiteSpace'};

export function addFontSize(
  acc: LayoutStyle,
  size: Responsive<TextSize | HeadingSize> | undefined
) {
  addLayoutProp(acc, 'fontSize', size, FONT_SIZE_OPTIONS);
}

export function addDensity(acc: LayoutStyle, density: Responsive<Density> | undefined) {
  addLayoutProp(acc, 'lineHeight', density, DENSITY_OPTIONS);
}

/**
 * The styles Text and Heading share. Font size, line height, display and font
 * weight differ between the two and are added by each.
 */
export function addCommonTextStyles(
  acc: LayoutStyle,
  p: BaseTextProps,
  {fullWidthEllipsis}: {fullWidthEllipsis: boolean}
) {
  addLayoutProp(acc, 'textAlign', p.align, TEXT_ALIGN_OPTIONS);
  addLayoutProp(acc, 'cursor', p.cursor, CURSOR_OPTIONS);
  addLayoutProp(
    acc,
    'whiteSpace',
    p.wrap ?? (p.ellipsis ? 'nowrap' : undefined),
    WHITE_SPACE_OPTIONS
  );

  const decoration = getDecorationKey(p);
  addStyles(
    acc,
    styles.reset,
    p.monospace ? styles.mono : styles.sans,
    p.italic && styles.italic,
    p.ellipsis && styles.ellipsis,
    p.ellipsis && fullWidthEllipsis && styles.fullWidth,
    p.uppercase && styles.uppercase,
    getColorStyle(p.variant),
    decoration && decorations[decoration],
    p.tabular && p.fraction
      ? numerics.both
      : p.tabular
        ? numerics.tabular
        : p.fraction && numerics.fraction,
    p.textWrap && textWraps[p.textWrap],
    p.wordBreak && wordBreaks[p.wordBreak]
  );
}

export function getFontWeightStyle(
  monospace: boolean | undefined,
  weight: 'regular' | 'medium'
) {
  if (monospace) {
    return weight === 'medium' ? weights.monoMedium : weights.monoRegular;
  }
  return weight === 'medium' ? weights.sansMedium : weights.sansRegular;
}

export const inheritStyles = {
  fontSize: styles.inheritFontSize,
  lineHeight: styles.inheritLineHeight,
  fontWeight: styles.inheritFontWeight,
};
