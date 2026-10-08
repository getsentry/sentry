import isPropValid from '@emotion/is-prop-valid';
import * as stylex from '@stylexjs/stylex';

import {
  fontWeight,
  form,
  motion,
  radius,
  space,
} from '@sentry/scraps/theme/constants.stylex';
import {background, colors, focus, interactive} from '@sentry/scraps/theme/tokens.stylex';

import type {ButtonSize, ButtonVariant} from './types';

/**
 * StyleX port of `DO_NOT_USE_getButtonStyles`. The variant colors are exposed
 * as custom properties so the `::before` (chonk) and `::after` (surface)
 * pseudo-elements can share one set of rules:
 *
 * - `--button-surface`  surface color (`::after`)
 * - `--button-chonk`    chonk and border color (`::before`, `::after` border)
 * - `--button-elevation` resting height of the chonk, per size
 * - `--button-lift`     current lift of the surface; drops on hover/active
 */
const SNAP = `transform ${motion.snapFast}`;

export const buttonStyles = stylex.create({
  base: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    fontWeight: fontWeight.sansMedium,
    cursor: 'pointer',
    // Longhands throughout: StyleX drops the `border` and `background` shorthands.
    borderWidth: 0,
    borderStyle: 'none',
    borderColor: 'currentcolor',
    backgroundColor: 'transparent',
    backgroundImage: 'none',
    outline: {default: null, ':focus-visible': 'none'},

    '::before': {
      content: '""',
      display: 'block',
      position: 'absolute',
      inset: 0,
      height: 'calc(100% - var(--button-elevation))',
      top: 'var(--button-elevation)',
      transform: 'translateY(calc(-1 * var(--button-elevation)))',
      boxShadow: '0 var(--button-elevation) 0 0px var(--button-chonk)',
      backgroundColor: 'var(--button-chonk)',
      borderRadius: 'inherit',
    },

    '::after': {
      content: '""',
      display: 'block',
      position: 'absolute',
      inset: 0,
      backgroundColor: 'var(--button-surface)',
      borderRadius: 'inherit',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'var(--button-chonk)',
      transform: 'translateY(calc(-1 * var(--button-lift)))',
      transition: SNAP,
      // Three layers: the chonk color masks the offset ring copy, then the
      // ring is drawn at the lift offset and again at rest, so it closes
      // around the surface and chonk as a single outline.
      boxShadow: {
        default: null,
        ':focus-visible': `0 var(--button-lift) 0 0 var(--button-chonk), 0 var(--button-lift) 0 2px ${focus.default}, 0 0 0 2px ${focus.default}`,
      },
    },
  },

  // A button that is (aria-)disabled or busy no longer lifts.
  disabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
    '--button-lift': '0px',
  },
  busy: {
    cursor: 'progress',
    '--button-lift': '0px',
  },
  // `aria-expanded` / `aria-checked`: pressed, without the lift transition.
  pressed: {
    '--button-lift': '0px',
    '::after': {transition: 'none'},
  },

  // Borderless buttons are not chonky.
  borderless: {
    transform: 'translateY(0px)',
    boxShadow: {
      default: null,
      ':focus-visible': `0 0 0 0 ${background.primary}, 0 0 0 2px ${focus.default}`,
    },
    backgroundColor: {
      default: 'transparent',
      ':hover': colors.gray100,
      ':active': colors.gray200,
    },
    '::before': {display: 'none'},
    '::after': {display: 'none'},
  },
  borderlessInert: {
    backgroundColor: {default: 'transparent', ':hover': 'inherit', ':active': 'inherit'},
  },
  link: {
    padding: 0,
    height: 'auto',
    minHeight: 'auto',
    minWidth: 'auto',
  },
});

const lift = (elevation: string) => ({
  '--button-elevation': elevation,
  '--button-lift': {
    default: elevation,
    ':hover': `calc(${elevation} + 1px)`,
    ':active': '0px',
  },
});

export const buttonSizeStyles = stylex.create({
  md: {
    ...lift('2px'),
    borderRadius: radius.lg,
    padding: `${space.md} ${space.xl}`,
    height: form.mdHeight,
    minHeight: form.mdMinHeight,
    fontSize: form.mdFontSize,
    lineHeight: form.mdLineHeight,
  },
  sm: {
    ...lift('2px'),
    borderRadius: radius.md,
    padding: `${space.md} ${space.lg}`,
    height: form.smHeight,
    minHeight: form.smMinHeight,
    fontSize: form.smFontSize,
    lineHeight: form.smLineHeight,
  },
  xs: {
    ...lift('1px'),
    borderRadius: radius.sm,
    padding: `${space.sm} ${space.md}`,
    height: form.xsHeight,
    minHeight: form.xsMinHeight,
    fontSize: form.xsFontSize,
    lineHeight: form.xsLineHeight,
  },
  zero: {
    ...lift('0px'),
    borderRadius: radius.xs,
    padding: `${space.xs} ${space.sm}`,
    height: '24px',
    minHeight: '24px',
    fontSize: '0.75rem',
    lineHeight: '1rem',
  },
});

// Use min width as a progressive enhancement for square buttons.
export const buttonSquareStyles = stylex.create({
  md: {padding: 0, minWidth: form.mdHeight},
  sm: {padding: 0, minWidth: form.smHeight},
  xs: {padding: 0, minWidth: form.xsHeight},
  zero: {padding: 0, minWidth: '24px'},
});

const focusBorder = (color: string) => ({
  '::after': {
    borderWidth: {default: '1px', ':focus-visible': '2px'},
    borderStyle: {default: 'solid', ':focus-visible': 'dotted'},
    borderColor: {default: 'var(--button-chonk)', ':focus-visible': color},
    boxShadow: null,
  },
});

export const buttonVariantStyles = stylex.create({
  primary: {
    '--button-surface': interactive.chonkyEmbossedAccentBackground,
    '--button-chonk': interactive.chonkyEmbossedAccentChonk,
    color: interactive.chonkyEmbossedAccentContent,
    ...focusBorder(focus.onVibrantLight),
  },
  secondary: {
    '--button-surface': interactive.chonkyEmbossedNeutralBackground,
    '--button-chonk': interactive.chonkyEmbossedNeutralChonk,
    color: interactive.chonkyEmbossedNeutralContentPrimary,
  },
  warning: {
    '--button-surface': interactive.chonkyEmbossedWarningBackground,
    '--button-chonk': interactive.chonkyEmbossedWarningChonk,
    color: interactive.chonkyEmbossedWarningContent,
    ...focusBorder(focus.onVibrantDark),
  },
  danger: {
    '--button-surface': interactive.chonkyEmbossedDangerBackground,
    '--button-chonk': interactive.chonkyEmbossedDangerChonk,
    color: interactive.chonkyEmbossedDangerContent,
    ...focusBorder(focus.onVibrantLight),
  },
  transparent: {
    '--button-surface': interactive.transparentNeutralBackgroundRest,
    '--button-chonk': interactive.transparentNeutralBackgroundRest,
    color: interactive.transparentNeutralContentPrimary,
  },
  link: {
    '--button-surface': 'transparent',
    '--button-chonk': 'transparent',
    color: interactive.linkAccentRest,
  },
});

/**
 * The content wrapper, the button's only child (`> span:last-child` in the
 * Emotion styles). It moves with the surface.
 */
export const buttonContentStyles = stylex.create({
  base: {
    zIndex: 1,
    position: 'relative',
    display: 'inherit',
    alignItems: 'inherit',
    justifyContent: 'inherit',
    flex: '1',
    gap: 'inherit',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    minWidth: 0,
    height: '100%',
    transform: 'translateY(calc(-1 * var(--button-lift)))',
    transition: SNAP,
  },
  // Borderless (transparent, link) variants replaced the whole content rule in
  // the Emotion styles, keeping only the content's own flex layout.
  borderlessBase: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    height: '100%',
    whiteSpace: 'nowrap',
    transform: 'translateY(0px)',
  },
  busy: {overflow: 'visible'},
  // Button hides its content behind the busy indicator; LinkButton has none.
  hidden: {visibility: 'hidden'},
  // The link variant's content rule replaced the borderless one entirely.
  link: {color: 'inherit', transform: 'none'},
  pressed: {transition: 'none'},
});

export interface ButtonStyleState {
  busy: boolean | undefined;
  disabled: boolean;
  pressed: boolean;
  size: ButtonSize;
  square: boolean;
  variant: ButtonVariant;
}

function isBorderless(variant: ButtonVariant) {
  return variant === 'transparent' || variant === 'link';
}

export function getButtonStyleProps(s: ButtonStyleState, xstyle?: stylex.StyleXStyles) {
  const borderless = isBorderless(s.variant);
  return stylex.props(
    buttonStyles.base,
    buttonSizeStyles[s.size],
    s.square && buttonSquareStyles[s.size],
    buttonVariantStyles[s.variant],
    borderless && buttonStyles.borderless,
    borderless &&
      (s.busy || s.disabled || s.variant === 'link') &&
      buttonStyles.borderlessInert,
    s.variant === 'link' && buttonStyles.link,
    s.pressed && buttonStyles.pressed,
    s.disabled && buttonStyles.disabled,
    s.busy && buttonStyles.busy,
    xstyle
  );
}

export function getButtonContentStyleProps(
  s: ButtonStyleState,
  {hideWhenBusy}: {hideWhenBusy: boolean}
) {
  return stylex.props(
    isBorderless(s.variant)
      ? buttonContentStyles.borderlessBase
      : buttonContentStyles.base,
    s.busy && buttonContentStyles.busy,
    s.busy && hideWhenBusy && buttonContentStyles.hidden,
    s.variant === 'link' && buttonContentStyles.link,
    s.pressed && buttonContentStyles.pressed
  );
}

// Button props that are not DOM attributes (some, like `size`, would pass
// isPropValid).
const BUTTON_PROPS: ReadonlySet<string> = new Set([
  'analyticsEventKey',
  'analyticsEventName',
  'analyticsParams',
  'busy',
  'icon',
  'size',
  'tooltipProps',
  'variant',
  'xstyle',
]);

function isTrue(value: unknown) {
  return value === true || value === 'true';
}

/**
 * Drops the props the Emotion `styled('button')` would not have forwarded.
 */
export function getButtonDomProps<P extends Record<string, any>>(
  props: P,
  omit: ReadonlySet<string> = BUTTON_PROPS
): Partial<P> {
  const domProps: Record<string, unknown> = {};
  for (const key in props) {
    if (!omit.has(key) && isPropValid(key)) {
      domProps[key] = props[key];
    }
  }
  return domProps as Partial<P>;
}

export function getButtonStyleState(
  props: {
    'aria-checked'?: unknown;
    'aria-disabled'?: unknown;
    'aria-expanded'?: unknown;
    busy?: boolean;
    disabled?: boolean;
    variant?: ButtonVariant;
  },
  size: ButtonSize,
  hasChildren: boolean
): ButtonStyleState {
  return {
    busy: props.busy,
    // A button that is only aria-disabled stays focusable (so its tooltip can
    // open on focus) but must look and hover like a disabled one.
    disabled: !!props.disabled || isTrue(props['aria-disabled']),
    pressed: isTrue(props['aria-expanded']) || isTrue(props['aria-checked']),
    size,
    square: !hasChildren,
    variant: props.variant ?? 'secondary',
  };
}
