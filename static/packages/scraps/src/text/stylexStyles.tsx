import * as stylex from '@stylexjs/stylex';

import type {Responsive} from '@sentry/scraps/layout/styles';
import {
  addLayoutProp,
  addStyles,
  type LayoutStyle,
} from '@sentry/scraps/layout/stylexLayout';
import type {ContentVariant, HeadingSize, TextSize, Theme} from '@sentry/scraps/theme';
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from '@sentry/scraps/theme/constants.stylex';
import {content} from '@sentry/scraps/theme/tokens.stylex';

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

const styles = stylex.create({
  reset: {
    // Reset any margin or padding that might be set by the global CSS styles.
    margin: 0,
    padding: 0,
    textBoxEdge: 'text text',
    textBoxTrim: 'trim-both',
  },
  sans: {fontFamily: fontFamily.sans},
  mono: {fontFamily: fontFamily.mono},
  italic: {fontStyle: 'italic'},
  ellipsis: {overflow: 'hidden', textOverflow: 'ellipsis'},
  fullWidth: {width: '100%'},
  uppercase: {textTransform: 'uppercase'},
  inheritFontSize: {fontSize: 'inherit'},
  inheritLineHeight: {lineHeight: 'inherit'},
  inheritFontWeight: {fontWeight: 'inherit'},
});

const weights = stylex.create({
  sansRegular: {fontWeight: fontWeight.sansRegular},
  sansMedium: {fontWeight: fontWeight.sansMedium},
  monoRegular: {fontWeight: fontWeight.monoRegular},
  monoMedium: {fontWeight: fontWeight.monoMedium},
});

const colors = stylex.create({
  primary: {color: content.primary},
  secondary: {color: content.secondary},
  accent: {color: content.accent},
  promotion: {color: content.promotion},
  danger: {color: content.danger},
  warning: {color: content.warning},
  success: {color: content.success},
});

const decorations = stylex.create({
  'line-through': {textDecoration: 'line-through'},
  underline: {textDecoration: 'underline'},
  'underline dotted': {textDecoration: 'underline dotted'},
  'line-through underline': {textDecoration: 'line-through underline'},
  'line-through underline dotted': {textDecoration: 'line-through underline dotted'},
});

const numerics = stylex.create({
  tabular: {fontVariantNumeric: 'tabular-nums'},
  fraction: {fontVariantNumeric: 'diagonal-fractions'},
  both: {fontVariantNumeric: 'tabular-nums diagonal-fractions'},
});

const textWraps = stylex.create({
  wrap: {textWrap: 'wrap'},
  nowrap: {textWrap: 'nowrap'},
  balance: {textWrap: 'balance'},
  pretty: {textWrap: 'pretty'},
  stable: {textWrap: 'stable'},
});

const wordBreaks = stylex.create({
  normal: {wordBreak: 'normal'},
  'break-all': {wordBreak: 'break-all'},
  'keep-all': {wordBreak: 'keep-all'},
  'break-word': {wordBreak: 'break-word'},
});

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
