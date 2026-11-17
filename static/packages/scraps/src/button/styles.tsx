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

/**
 * Every variant lists its complete styles. Variants share no style objects,
 * so a nested rule such as `> span:last-child` or `&:hover` in one variant
 * can never replace part of another's. Keep the rules in the same order in
 * every variant: rules with equal specificity, such as `&:hover` and
 * `&:active`, resolve by source order.
 */
const buttonVariants: Record<ButtonVariant, (p: ButtonStyleProps) => StrictCSSObject> = {
  primary: p => getChonkyStyles(p, getChonkyTokens('primary', p.theme)),
  secondary: p => getChonkyStyles(p, getChonkyTokens('secondary', p.theme)),
  warning: p => getChonkyStyles(p, getChonkyTokens('warning', p.theme)),
  danger: p => getChonkyStyles(p, getChonkyTokens('danger', p.theme)),
  transparent: getTransparentStyles,
  link: getLinkStyles,
};

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

  return buttonVariants[p.variant ?? 'secondary']({
    disabled,
    inactive: disabled || Boolean(p.busy),
    shapeVariant: p.shapeVariant,
    size: p.size,
    theme: p.theme,
  });
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

function getChonkyTokens(
  variant: 'primary' | 'secondary' | 'warning' | 'danger',
  theme: Theme
): ChonkyTokens {
  const {embossed} = theme.tokens.interactive.chonky;

  switch (variant) {
    case 'primary':
      return {
        surface: embossed.accent.background,
        chonk: embossed.accent.chonk,
        content: embossed.accent.content,
        focus: {border: `2px dotted ${theme.tokens.focus.onVibrant.light}`},
      };
    case 'secondary':
      return {
        surface: embossed.neutral.background,
        chonk: embossed.neutral.chonk,
        content: embossed.neutral.content.primary,
        focus: {
          // Three layers: the chonk color masks the offset ring copy, then
          // the ring is drawn at the lift offset and again at rest, so it
          // closes around the surface and chonk as a single outline.
          boxShadow: `0 var(--button-lift) 0 0 ${embossed.neutral.chonk}, 0 var(--button-lift) 0 2px ${theme.tokens.focus.default}, 0 0 0 2px ${theme.tokens.focus.default}`,
        },
      };
    case 'warning':
      return {
        surface: embossed.warning.background,
        chonk: embossed.warning.chonk,
        content: embossed.warning.content,
        focus: {border: `2px dotted ${theme.tokens.focus.onVibrant.dark}`},
      };
    case 'danger':
      return {
        surface: embossed.danger.background,
        chonk: embossed.danger.chonk,
        content: embossed.danger.content,
        focus: {border: `2px dotted ${theme.tokens.focus.onVibrant.light}`},
      };
  }
}

function getChonkyStyles(p: ButtonStyleProps, tokens: ChonkyTokens): StrictCSSObject {
  const size = getSizeTokens(p.size, p.theme);

  return {
    '--button-lift': size.lift,

    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',

    fontWeight: p.theme.font.weight.sans.medium,

    opacity: p.disabled ? 0.6 : undefined,

    cursor: 'pointer',
    '&[disabled], &[aria-disabled="true"]': {
      cursor: 'not-allowed',
    },

    padding: p.shapeVariant === 'square' ? '0' : size.padding,
    borderRadius: size.borderRadius,
    border: 'none',
    color: tokens.content,

    background: 'none',

    height: size.height,
    // Use min width as a progressive enhancement for square buttons.
    // We can't yet swap to width because I'm not entirely condifent that
    // that would not break existing buttons.
    minWidth: p.shapeVariant === 'square' ? size.height : undefined,

    minHeight: size.minHeight,
    fontSize: size.fontSize,
    lineHeight: size.lineHeight,

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

    '&[aria-busy="true"] > span:last-child': {
      overflow: 'visible',
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

    '&[aria-busy="true"]': {
      cursor: 'progress',
    },
  };
}

function getTransparentStyles(p: ButtonStyleProps): StrictCSSObject {
  const size = getSizeTokens(p.size, p.theme);

  return {
    '--button-lift': size.lift,

    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',

    fontWeight: p.theme.font.weight.sans.medium,

    opacity: p.disabled ? 0.6 : undefined,

    cursor: 'pointer',
    '&[disabled], &[aria-disabled="true"]': {
      cursor: 'not-allowed',
    },

    padding: p.shapeVariant === 'square' ? '0' : size.padding,
    borderRadius: size.borderRadius,
    border: 'none',
    color: p.theme.tokens.interactive.transparent.neutral.content.primary,

    background: 'none',

    height: size.height,
    minWidth: p.shapeVariant === 'square' ? size.height : undefined,

    minHeight: size.minHeight,
    fontSize: size.fontSize,
    lineHeight: size.lineHeight,

    '&::before': {display: 'none'},

    '&::after': {display: 'none'},

    '&:focus-visible': p.theme.focusRing(),

    '&[aria-busy="true"] > span:last-child': {
      overflow: 'visible',
    },

    // No flex layout and no `overflow: hidden`. Call sites rely on this, for
    // example to let an avatar stack overflow a `zero` button. The button
    // layout snapshots pin it.
    '> span:last-child': {
      transform: 'translateY(0px)',
    },

    '&:hover': {
      '> span:last-child': {transform: 'translateY(0px)'},
      backgroundColor: p.inactive ? 'inherit' : p.theme.colors.gray100,
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

    '&[aria-busy="true"]': {
      cursor: 'progress',
    },

    transform: 'translateY(0px)',

    '&:active': {
      '> span:last-child': {
        transform: 'translateY(0px)',
      },

      backgroundColor: p.inactive ? 'inherit' : p.theme.colors.gray200,
    },
  };
}

function getLinkStyles(p: ButtonStyleProps): StrictCSSObject {
  const size = getSizeTokens(p.size, p.theme);

  return {
    '--button-lift': size.lift,

    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',

    fontWeight: p.theme.font.weight.sans.medium,

    opacity: p.disabled ? 0.6 : undefined,

    cursor: 'pointer',
    '&[disabled], &[aria-disabled="true"]': {
      cursor: 'not-allowed',
    },

    padding: '0',
    borderRadius: size.borderRadius,
    border: 'none',
    color: p.theme.tokens.interactive.link.accent.rest,

    background: 'none',

    height: 'auto',
    minWidth: 'auto',

    minHeight: 'auto',
    fontSize: size.fontSize,
    lineHeight: size.lineHeight,

    '&::before': {display: 'none'},

    '&::after': {display: 'none'},

    '&:focus-visible': p.theme.focusRing(),

    '&[aria-busy="true"] > span:last-child': {
      overflow: 'visible',
    },

    // Like transparent, no flex layout and no `overflow: hidden`.
    '> span:last-child': {
      color: 'inherit',
    },

    '&:hover': {
      '> span:last-child': {transform: 'translateY(0px)'},
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

    '&[aria-busy="true"]': {
      cursor: 'progress',
    },

    transform: 'translateY(0px)',

    '&:active': {
      '> span:last-child': {
        transform: 'translateY(0px)',
      },

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
