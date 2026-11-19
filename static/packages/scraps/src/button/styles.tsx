import {type SVGIconProps} from '@sentry/icons/svgIcon';

import type {ButtonProps} from '@sentry/scraps/button';
import type {StrictCSSObject, Theme} from '@sentry/scraps/theme';

import {
  type ButtonVariant,
  type ButtonSize,
  type DO_NOT_USE_CommonButtonProps as CommonButtonProps,
} from './types';

export const DO_NOT_USE_BUTTON_ICON_SIZES: Record<ButtonSize, SVGIconProps['size']> = {
  zero: 'xs',
  xs: 'xs',
  sm: 'sm',
  md: 'sm',
};

interface ButtonStyleProps {
  /**
   * True when the button is disabled or aria-disabled.
   */
  disabled: boolean;
  /**
   * True when the button is disabled, aria-disabled, or busy. It keeps its
   * color on focus and hover and gets no hover background.
   */
  inactive: boolean;
  shapeVariant: 'rectangular' | 'square';
  size: ButtonSize;
  theme: Theme;
}

type ChonkyVariant = Exclude<ButtonVariant, 'transparent' | 'link'>;

export function DO_NOT_USE_getButtonStyles(
  p: Pick<CommonButtonProps, 'variant' | 'busy'> &
    Pick<ButtonProps, 'disabled' | 'aria-disabled'> & {
      shapeVariant: 'rectangular' | 'square';
      size: ButtonSize;
      theme: Theme;
    }
): StrictCSSObject {
  // A button that is only aria-disabled stays focusable (so its tooltip can
  // open on focus) but must look and hover like a disabled one.
  const ariaDisabled = p['aria-disabled'];
  const disabled = Boolean(
    p.disabled || ariaDisabled === true || ariaDisabled === 'true'
  );
  const props: ButtonStyleProps = {
    disabled,
    inactive: disabled || Boolean(p.busy),
    shapeVariant: p.shapeVariant,
    size: p.size,
    theme: p.theme,
  };

  const variant = p.variant ?? 'secondary';
  switch (variant) {
    case 'transparent':
      return getTransparentStyles(props);
    case 'link':
      return getLinkStyles(props);
    default:
      return getChonkyStyles(props, chonkyTokens[variant](p.theme));
  }
}

/**
 * Rules every variant uses unchanged. No variant sets any of these keys, so
 * spreading this first can't replace part of a variant's nested rule.
 */
function getBaseStyles(
  p: ButtonStyleProps,
  size: ReturnType<typeof getSizeTokens>
): StrictCSSObject {
  return {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',

    fontWeight: p.theme.font.weight.sans.medium,
    fontSize: size.fontSize,
    lineHeight: size.lineHeight,

    opacity: p.disabled ? 0.6 : undefined,

    borderRadius: size.borderRadius,
    border: 'none',
    background: 'none',

    cursor: 'pointer',
    '&[disabled], &[aria-disabled="true"]': {
      cursor: 'not-allowed',
    },
    '&[aria-busy="true"]': {
      cursor: 'progress',
    },
  };
}

interface ChonkyTokens {
  chonk: string;
  content: string;
  /**
   * Applied to `&::after` while the button has keyboard focus.
   */
  focus: StrictCSSObject;
  surface: string;
}

const chonkyTokens: Record<ChonkyVariant, (theme: Theme) => ChonkyTokens> = {
  primary: theme => ({
    surface: theme.tokens.interactive.chonky.embossed.accent.background,
    chonk: theme.tokens.interactive.chonky.embossed.accent.chonk,
    content: theme.tokens.interactive.chonky.embossed.accent.content,
    focus: {border: `2px dotted ${theme.tokens.focus.onVibrant.light}`},
  }),
  secondary: theme => ({
    surface: theme.tokens.interactive.chonky.embossed.neutral.background,
    chonk: theme.tokens.interactive.chonky.embossed.neutral.chonk,
    content: theme.tokens.interactive.chonky.embossed.neutral.content.primary,
    focus: {
      // Three layers: the chonk color masks the offset ring copy, then
      // the ring is drawn at the lift offset and again at rest, so it
      // closes around the surface and chonk as a single outline.
      boxShadow: `0 var(--button-lift) 0 0 ${theme.tokens.interactive.chonky.embossed.neutral.chonk}, 0 var(--button-lift) 0 2px ${theme.tokens.focus.default}, 0 0 0 2px ${theme.tokens.focus.default}`,
    },
  }),
  warning: theme => ({
    surface: theme.tokens.interactive.chonky.embossed.warning.background,
    chonk: theme.tokens.interactive.chonky.embossed.warning.chonk,
    content: theme.tokens.interactive.chonky.embossed.warning.content,
    focus: {border: `2px dotted ${theme.tokens.focus.onVibrant.dark}`},
  }),
  danger: theme => ({
    surface: theme.tokens.interactive.chonky.embossed.danger.background,
    chonk: theme.tokens.interactive.chonky.embossed.danger.chonk,
    content: theme.tokens.interactive.chonky.embossed.danger.content,
    focus: {border: `2px dotted ${theme.tokens.focus.onVibrant.light}`},
  }),
};

/**
 * The chonky variants are the only ones with a lift: `--button-lift` drives
 * the surface and label offset. Keep `&:hover` before the `&:active` and
 * disabled rules, which share its specificity and must win over it.
 */
function getChonkyStyles(p: ButtonStyleProps, tokens: ChonkyTokens): StrictCSSObject {
  const size = getSizeTokens(p.size, p.theme);

  return {
    ...getBaseStyles(p, size),

    '--button-lift': size.lift,

    padding: p.shapeVariant === 'square' ? '0' : size.padding,
    height: size.height,
    minHeight: size.minHeight,
    // Use min width as a progressive enhancement for square buttons.
    // We can't yet swap to width because I'm not entirely condifent that
    // that would not break existing buttons.
    minWidth: p.shapeVariant === 'square' ? size.height : undefined,
    color: tokens.content,

    '&::before': {
      content: '""',
      display: 'block',
      position: 'absolute',
      inset: '0',
      height: `calc(100% - ${size.lift})`,
      top: size.lift,
      transform: `translateY(-${size.lift})`,
      boxShadow: `0 ${size.lift} 0 0px ${tokens.chonk}`,
      background: tokens.chonk,
      borderRadius: 'inherit',
    },

    '&::after': {
      content: '""',
      display: 'block',
      position: 'absolute',
      inset: '0',
      background: tokens.surface,
      borderRadius: 'inherit',
      border: `1px solid ${tokens.chonk}`,
      transform: 'translateY(calc(-1 * var(--button-lift)))',
      transition: `transform ${p.theme.motion.snap.fast}`,
    },

    '&:focus-visible': {
      outline: 'none',
      color: p.inactive ? undefined : tokens.content,

      '&::after': tokens.focus,
    },

    '> span:last-child': {
      zIndex: 1,
      position: 'relative',

      display: 'inherit',
      alignItems: 'inherit',
      justifyContent: 'inherit',
      flex: '1',
      gap: 'inherit',
      overflow: 'hidden',

      whiteSpace: 'nowrap',
      transform: 'translateY(calc(-1 * var(--button-lift)))',
      transition: `transform ${p.theme.motion.snap.fast}`,
    },

    '&[aria-busy="true"] > span:last-child': {
      overflow: 'visible',
    },

    '&:hover': {
      '--button-lift': `calc(${size.lift} + 1px)`,
      color: p.inactive ? undefined : tokens.content,
    },

    '&:active, &[aria-expanded="true"], &[aria-checked="true"]': {
      '--button-lift': '0px',
    },

    '&[aria-expanded="true"], &[aria-checked="true"]': {
      '&::after': {
        transition: 'none',
      },
      '> span:last-child': {
        transition: 'none',
      },
    },

    '&:disabled, &[aria-disabled="true"], &[aria-busy="true"]': {
      '--button-lift': '0px',
    },
  };
}

/**
 * Keep `&:hover` before `&:active`: they share specificity, and the pressed
 * background must win.
 */
function getTransparentStyles(p: ButtonStyleProps): StrictCSSObject {
  const size = getSizeTokens(p.size, p.theme);

  return {
    ...getBaseStyles(p, size),

    padding: p.shapeVariant === 'square' ? '0' : size.padding,
    height: size.height,
    minHeight: size.minHeight,
    minWidth: p.shapeVariant === 'square' ? size.height : undefined,
    color: p.theme.tokens.interactive.transparent.neutral.content.primary,
    transform: 'translateY(0px)',

    '&::before': {display: 'none'},
    '&::after': {display: 'none'},

    '&:focus-visible': p.theme.focusRing(),

    // No flex layout and no `overflow: hidden`. Call sites rely on this, for
    // example to let an avatar stack overflow a `zero` button. The button
    // layout snapshots pin it.
    '> span:last-child': {
      transform: 'translateY(0px)',
    },

    '&:hover': {
      backgroundColor: p.inactive ? 'inherit' : p.theme.colors.gray100,
    },

    '&:active': {
      backgroundColor: p.inactive ? 'inherit' : p.theme.colors.gray200,
    },
  };
}

function getLinkStyles(p: ButtonStyleProps): StrictCSSObject {
  const size = getSizeTokens(p.size, p.theme);

  return {
    ...getBaseStyles(p, size),

    padding: '0',
    height: 'auto',
    minHeight: 'auto',
    minWidth: 'auto',
    color: p.theme.tokens.interactive.link.accent.rest,
    transform: 'translateY(0px)',

    '&::before': {display: 'none'},
    '&::after': {display: 'none'},

    '&:focus-visible': p.theme.focusRing(),

    // Like transparent, no flex layout and no `overflow: hidden`.
    '> span:last-child': {
      color: 'inherit',
    },

    // The label has no transform at rest. Applying one on hover and press
    // makes it a containing block and stacking context for its children.
    '&:hover': {
      '> span:last-child': {transform: 'translateY(0px)'},
    },

    '&:active': {
      '> span:last-child': {transform: 'translateY(0px)'},
      backgroundColor: 'inherit',
    },
  };
}

function getSizeTokens(size: ButtonSize, theme: Theme) {
  switch (size) {
    case 'md':
      return {
        height: '36px',
        minHeight: '36px',
        fontSize: '0.875rem',
        lineHeight: '1rem',
        padding: `${theme.space.md} ${theme.space.xl}`,
        borderRadius: theme.radius.lg,
        lift: '2px',
      };
    case 'sm':
      return {
        height: '32px',
        minHeight: '32px',
        fontSize: '0.875rem',
        lineHeight: '1rem',
        padding: `${theme.space.md} ${theme.space.lg}`,
        borderRadius: theme.radius.md,
        lift: '2px',
      };
    case 'xs':
      return {
        height: '28px',
        minHeight: '28px',
        fontSize: '0.75rem',
        lineHeight: '1rem',
        padding: `${theme.space.sm} ${theme.space.md}`,
        borderRadius: theme.radius.sm,
        lift: '1px',
      };
    case 'zero':
      return {
        height: '24px',
        minHeight: '24px',
        fontSize: '0.75rem',
        lineHeight: '1rem',
        padding: `${theme.space.xs} ${theme.space.sm}`,
        borderRadius: theme.radius.xs,
        lift: '0px',
      };
  }
}
