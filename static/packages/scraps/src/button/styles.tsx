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
  busy: boolean;
  /**
   * True when the button is disabled or aria-disabled.
   */
  disabled: boolean;
  shapeVariant: 'rectangular' | 'square';
  size: SizeTokens;
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
    busy: Boolean(p.busy),
    disabled,
    shapeVariant: p.shapeVariant,
    size: getSizeTokens(p.size, p.theme),
    theme: p.theme,
  };

  const variant = p.variant ?? 'secondary';
  switch (variant) {
    case 'transparent':
      return getTransparentStyles(props);
    case 'link':
      return getLinkStyles(props);
    default:
      return getChonkyStyles(
        props,
        chonkyTokens[variant](p.theme.tokens.interactive.chonky.embossed, p.theme)
      );
  }
}

/**
 * Rules every variant uses unchanged. No variant sets any of these keys, so
 * spreading this first can't replace part of a variant's nested rule.
 */
function getBaseStyles(p: ButtonStyleProps): StrictCSSObject {
  return {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',

    fontWeight: p.theme.font.weight.sans.medium,
    fontSize: p.size.fontSize,
    lineHeight: p.size.lineHeight,

    opacity: p.disabled ? 0.6 : undefined,

    borderRadius: p.size.borderRadius,
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

type EmbossedTokens = Theme['tokens']['interactive']['chonky']['embossed'];

const chonkyTokens: Record<
  ChonkyVariant,
  (embossed: EmbossedTokens, theme: Theme) => ChonkyTokens
> = {
  primary: (embossed, theme) => ({
    surface: embossed.accent.background,
    chonk: embossed.accent.chonk,
    content: embossed.accent.content,
    focus: {border: `2px dotted ${theme.tokens.focus.onVibrant.light}`},
  }),
  secondary: (embossed, theme) => ({
    surface: embossed.neutral.background,
    chonk: embossed.neutral.chonk,
    content: embossed.neutral.content.primary,
    focus: {
      // Three layers: the chonk color masks the offset ring copy, then
      // the ring is drawn at the lift offset and again at rest, so it
      // closes around the surface and chonk as a single outline.
      boxShadow: `0 var(--button-lift) 0 0 ${embossed.neutral.chonk}, 0 var(--button-lift) 0 2px ${theme.tokens.focus.default}, 0 0 0 2px ${theme.tokens.focus.default}`,
    },
  }),
  warning: (embossed, theme) => ({
    surface: embossed.warning.background,
    chonk: embossed.warning.chonk,
    content: embossed.warning.content,
    focus: {border: `2px dotted ${theme.tokens.focus.onVibrant.dark}`},
  }),
  danger: (embossed, theme) => ({
    surface: embossed.danger.background,
    chonk: embossed.danger.chonk,
    content: embossed.danger.content,
    focus: {border: `2px dotted ${theme.tokens.focus.onVibrant.light}`},
  }),
};

/**
 * The chonky variants are the only ones with a lift: `--button-lift` drives
 * the surface and label offset. Keep `&:hover` before the `&:active` and
 * disabled rules, which share its specificity and must win over it.
 */
function getChonkyStyles(p: ButtonStyleProps, tokens: ChonkyTokens): StrictCSSObject {
  return {
    ...getBaseStyles(p),

    '--button-lift': p.size.lift,

    padding: p.shapeVariant === 'square' ? '0' : p.size.padding,
    height: p.size.height,
    minHeight: p.size.minHeight,
    // Use min width as a progressive enhancement for square buttons.
    // We can't yet swap to width because I'm not entirely condifent that
    // that would not break existing buttons.
    minWidth: p.shapeVariant === 'square' ? p.size.height : undefined,
    color: tokens.content,

    '&::before': {
      content: '""',
      display: 'block',
      position: 'absolute',
      inset: '0',
      height: `calc(100% - ${p.size.lift})`,
      top: p.size.lift,
      transform: `translateY(-${p.size.lift})`,
      boxShadow: `0 ${p.size.lift} 0 0px ${tokens.chonk}`,
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
      color: p.disabled || p.busy ? undefined : tokens.content,

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
      '--button-lift': `calc(${p.size.lift} + 1px)`,
      color: p.disabled || p.busy ? undefined : tokens.content,
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
  return {
    ...getBaseStyles(p),

    padding: p.shapeVariant === 'square' ? '0' : p.size.padding,
    height: p.size.height,
    minHeight: p.size.minHeight,
    minWidth: p.shapeVariant === 'square' ? p.size.height : undefined,
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
      backgroundColor: p.disabled || p.busy ? 'inherit' : p.theme.colors.gray100,
    },

    '&:active': {
      backgroundColor: p.disabled || p.busy ? 'inherit' : p.theme.colors.gray200,
    },
  };
}

function getLinkStyles(p: ButtonStyleProps): StrictCSSObject {
  return {
    ...getBaseStyles(p),

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

    '&:active': {
      backgroundColor: 'inherit',
    },
  };
}

interface SizeTokens {
  borderRadius: string;
  fontSize: string;
  height: string;
  lift: string;
  lineHeight: string;
  minHeight: string;
  padding: string;
}

function getSizeTokens(size: ButtonSize, theme: Theme): SizeTokens {
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
