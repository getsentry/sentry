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

const elevation = {
  md: '2px',
  sm: '2px',
  xs: '1px',
  zero: '0px',
} satisfies Record<ButtonSize, string>;

const hoverElevation = '1px';

export function DO_NOT_USE_getButtonStyles(
  p: Pick<CommonButtonProps, 'variant' | 'busy'> &
    Pick<ButtonProps, 'disabled' | 'aria-disabled'> & {
      shapeVariant: 'rectangular' | 'square';
      size: ButtonSize;
      theme: Theme;
    }
): StrictCSSObject {
  const variant = p.variant ?? 'secondary';
  // A button that is only aria-disabled stays focusable (so its tooltip can
  // open on focus) but must look and hover like a disabled one.
  const ariaDisabled = p['aria-disabled'];
  const disabled = p.disabled || ariaDisabled === true || ariaDisabled === 'true';

  const buttonSizes = {
    ...p.theme.form,
    zero: {
      height: '24px',
      minHeight: '24px',
      fontSize: '0.75rem',
      lineHeight: '1rem',
    },
  } as const;

  const buttonTheme = getButtonTheme(variant, p.theme);
  const buttonElevation = elevation[p.size];
  const borderless = variant === 'transparent' || variant === 'link';
  const borderlessBackground = (background: string) =>
    p.busy || disabled || variant === 'link' ? 'inherit' : background;

  return {
    '--button-lift': buttonElevation,

    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',

    fontWeight: p.theme.font.weight.sans.medium,

    opacity: disabled ? 0.6 : undefined,

    cursor: 'pointer',
    '&[disabled], &[aria-disabled="true"]': {
      cursor: 'not-allowed',
    },

    padding:
      variant === 'link' || p.shapeVariant === 'square'
        ? '0'
        : getButtonSizeTheme(p.size, p.theme).padding,
    borderRadius: getButtonSizeTheme(p.size, p.theme).borderRadius,
    border: 'none',
    color: buttonTheme.color,

    background: 'none',

    height: variant === 'link' ? 'auto' : buttonSizes[p.size].height,
    // Use min width as a progressive enhancement for square buttons.
    // We can't yet swap to width because I'm not entirely condifent that
    // that would not break existing buttons.
    minWidth:
      variant === 'link'
        ? 'auto'
        : p.shapeVariant === 'square'
          ? buttonSizes[p.size].height
          : undefined,

    minHeight: variant === 'link' ? 'auto' : buttonSizes[p.size].minHeight,
    fontSize: buttonSizes[p.size].fontSize,
    lineHeight: buttonSizes[p.size].lineHeight,

    // Borderless buttons are not chonky
    '&::before': borderless
      ? {display: 'none'}
      : {
          content: '""',
          display: 'block',
          position: 'absolute',
          inset: '0',
          height: `calc(100% - ${buttonElevation})`,
          top: buttonElevation,
          transform: `translateY(-${buttonElevation})`,
          boxShadow: `0 ${buttonElevation} 0 0px ${buttonTheme.background}`,
          background: buttonTheme.background,
          borderRadius: 'inherit',
        },

    '&::after': borderless
      ? {display: 'none'}
      : {
          content: '""',
          display: 'block',
          position: 'absolute',
          inset: '0',
          background: buttonTheme.surface,
          borderRadius: 'inherit',
          border: `1px solid ${buttonTheme.background}`,
          transform: 'translateY(calc(-1 * var(--button-lift)))',
          transition: `transform ${p.theme.motion.snap.fast}`,
        },

    '&:focus-visible': borderless
      ? p.theme.focusRing()
      : {
          outline: 'none',
          color: disabled || p.busy ? undefined : buttonTheme.color,

          '&::after': buttonTheme.focus
            ? {border: `2px dotted ${buttonTheme.focus}`}
            : {
                // Three layers: the chonk color masks the offset ring copy, then
                // the ring is drawn at the lift offset and again at rest, so it
                // closes around the surface and chonk as a single outline.
                boxShadow: `0 var(--button-lift) 0 0 ${buttonTheme.background}, 0 var(--button-lift) 0 2px ${p.theme.tokens.focus.default}, 0 0 0 2px ${p.theme.tokens.focus.default}`,
              },
        },

    '&[aria-busy="true"] > span:last-child': {
      overflow: 'visible',
    },

    '> span:last-child': getLabelStyles(variant, p.theme),

    '&:hover':
      variant === 'link'
        ? {'> span:last-child': {transform: 'translateY(0px)'}}
        : variant === 'transparent'
          ? {
              '> span:last-child': {transform: 'translateY(0px)'},
              backgroundColor: borderlessBackground(p.theme.colors.gray100),
            }
          : {
              '--button-lift': `calc(${buttonElevation} + ${hoverElevation})`,
              color: disabled || p.busy ? undefined : buttonTheme.color,
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

    ...(borderless && {
      transform: 'translateY(0px)',

      '&:active': {
        '> span:last-child': {
          transform: 'translateY(0px)',
        },

        backgroundColor: borderlessBackground(p.theme.colors.gray200),
      },
    }),
  };
}

/**
 * Only the chonky variants lay out their label. The transparent and link
 * labels skip the flex layout and `overflow: hidden`, and call sites rely on
 * that, for example to let an avatar stack overflow a `zero` button. The
 * button layout snapshots pin these differences.
 */
function getLabelStyles(variant: ButtonVariant, theme: Theme): StrictCSSObject {
  switch (variant) {
    case 'link':
      return {color: 'inherit'};
    case 'transparent':
      return {transform: 'translateY(0px)'};
    default:
      return {
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
        transition: `transform ${theme.motion.snap.fast}`,
      };
  }
}

function getButtonTheme(variant: ButtonVariant, theme: Theme) {
  switch (variant) {
    case 'primary':
      return {
        surface: theme.tokens.interactive.chonky.embossed.accent.background,
        background: theme.tokens.interactive.chonky.embossed.accent.chonk,
        color: theme.tokens.interactive.chonky.embossed.accent.content,
        focus: theme.tokens.focus.onVibrant.light,
      };
    case 'secondary':
      return {
        surface: theme.tokens.interactive.chonky.embossed.neutral.background,
        background: theme.tokens.interactive.chonky.embossed.neutral.chonk,
        color: theme.tokens.interactive.chonky.embossed.neutral.content.primary,
      };
    case 'warning':
      return {
        surface: theme.tokens.interactive.chonky.embossed.warning.background,
        background: theme.tokens.interactive.chonky.embossed.warning.chonk,
        color: theme.tokens.interactive.chonky.embossed.warning.content,
        focus: theme.tokens.focus.onVibrant.dark,
      };
    case 'danger':
      return {
        surface: theme.tokens.interactive.chonky.embossed.danger.background,
        background: theme.tokens.interactive.chonky.embossed.danger.chonk,
        color: theme.tokens.interactive.chonky.embossed.danger.content,
        focus: theme.tokens.focus.onVibrant.light,
      };
    case 'transparent':
      return {
        surface: theme.tokens.interactive.transparent.neutral.background.rest,
        background: theme.tokens.interactive.transparent.neutral.background.rest,
        color: theme.tokens.interactive.transparent.neutral.content.primary,
      };
    case 'link':
      return {
        surface: 'transparent',
        background: 'transparent',
        color: theme.tokens.interactive.link.accent.rest,
      };
    default:
      return {};
  }
}

function getButtonSizeTheme(size: ButtonSize, theme: Theme): StrictCSSObject {
  switch (size) {
    case 'md':
      return {
        borderRadius: theme.radius.lg,
        padding: `${theme.space.md} ${theme.space.xl}`,
      };
    case 'sm':
      return {
        borderRadius: theme.radius.md,
        padding: `${theme.space.md} ${theme.space.lg}`,
      };
    case 'xs':
      return {
        borderRadius: theme.radius.sm,
        padding: `${theme.space.sm} ${theme.space.md}`,
      };
    case 'zero':
      return {
        borderRadius: theme.radius.xs,
        padding: `${theme.space.xs} ${theme.space.sm}`,
      };
    default:
      return {};
  }
}
