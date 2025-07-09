import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';
import color from 'color';

import type {DO_NOT_USE_ButtonProps as ButtonProps} from 'sentry/components/core/button/types';
// eslint-disable-next-line boundaries/element-types
import type {StrictCSSObject} from 'sentry/utils/theme';
// eslint-disable-next-line boundaries/element-types
import {unreachable} from 'sentry/utils/unreachable';

// @TODO: remove Link type in the future
type ChonkButtonType =
  | 'default'
  | 'transparent'
  | 'accent'
  | 'warning'
  | 'danger'
  | 'link';

function chonkPriorityToType(priority: ButtonProps['priority']): ChonkButtonType {
  switch (priority) {
    case 'primary':
      return 'accent';
    case 'danger':
      return 'danger';
    // @ts-expect-error the previous button did not have this variant, but we still want to
    // forward it so that we can write the stories for it
    case 'warning':
      return 'warning';
    case 'transparent':
      return 'transparent';
    case 'link':
      return 'link';
    default:
      return 'default';
  }
}

function chonkElevation(size: NonNullable<ButtonProps['size']>): string {
  switch (size) {
    case 'md':
      return '3px';
    case 'sm':
      return '2px';
    case 'xs':
      return '1px';
    case 'zero':
      return '0px';
    default:
      unreachable(size);
      throw new Error(`Unknown button size: ${size}`);
  }
}

export function DO_NOT_USE_getChonkButtonStyles(
  p: Pick<ButtonProps, 'priority' | 'busy' | 'disabled' | 'borderless'> & {
    size: NonNullable<ButtonProps['size']>;
    theme: DO_NOT_USE_ChonkTheme;
  }
): StrictCSSObject {
  const type = chonkPriorityToType(p.priority);

  const buttonSizes = {
    ...p.theme.form,
    zero: {
      height: '24px',
      minHeight: '24px',
      fontSize: '0.75rem',
      lineHeight: '1rem',
    },
  } as const;

  return {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',

    fontWeight: p.theme.fontWeight.bold,

    cursor: p.disabled ? 'not-allowed' : 'pointer',
    opacity: p.busy || p.disabled ? 0.6 : undefined,

    padding: getChonkButtonSizeTheme(p.size, p.theme).padding,
    borderRadius: getChonkButtonSizeTheme(p.size, p.theme).borderRadius,
    border: 'none',
    color: getChonkButtonTheme(type, p.theme).color,

    background: 'none',

    ...buttonSizes[p.size],

    '&::before': {
      content: '""',
      display: 'block',
      position: 'absolute',
      inset: '0',
      height: `calc(100% - ${chonkElevation(p.size)})`,
      top: `${chonkElevation(p.size)}`,
      transform: `translateY(-${chonkElevation(p.size)})`,
      boxShadow: `0 ${chonkElevation(p.size)} 0 0px ${getChonkButtonTheme(type, p.theme).background}`,
      background: getChonkButtonTheme(type, p.theme).background,
      borderRadius: 'inherit',
    },

    '&::after': {
      content: '""',
      display: 'block',
      position: 'absolute',
      inset: '0',
      background: getChonkButtonTheme(type, p.theme).surface,
      borderRadius: 'inherit',
      border: `1px solid ${getChonkButtonTheme(type, p.theme).background}`,
      transform: `translateY(-${chonkElevation(p.size)})`,
      transition: 'transform 0.06s ease-in-out',
    },

    '&:focus-visible': {
      outline: 'none',
      color: p.disabled || p.busy ? undefined : getChonkButtonTheme(type, p.theme).color,

      '&::after': {
        border: `1px solid ${p.theme.focusBorder}`,
        boxShadow: `0 0 0 1px ${p.theme.focusBorder}`,
      },
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
      transform: `translateY(-${chonkElevation(p.size)})`,
      transition: 'transform 0.06s ease-in-out',
    },

    '&:hover': {
      color: p.disabled || p.busy ? undefined : getChonkButtonTheme(type, p.theme).color,

      '&::after': {
        transform: `translateY(calc(-${chonkElevation(p.size)} - 2px))`,
      },
      '> span:last-child': {
        transform: `translateY(calc(-${chonkElevation(p.size)} - 2px))`,
      },
    },

    '&:active, &[aria-expanded="true"], &[aria-checked="true"]': {
      '&::after': {
        transform: 'translateY(0px)',
      },
      '> span:last-child': {
        transform: 'translateY(0px)',
      },
    },

    '&:disabled, &[aria-disabled="true"]': {
      '&::after': {
        transform: 'translateY(0px)',
      },
      '> span:last-child': {
        transform: 'translateY(0px)',
      },
    },

    // Hides the interaction state layer
    '> span:first-child': {
      display: 'none',
    },

    // Link buttons do not have interaction state layer
    ...(p.priority === 'link' && {
      transform: 'translateY(0px)',

      '> span:first-child': {
        transform: 'translateY(0px)',
      },

      '&::before': {
        display: 'none',
      },

      '&::after': {
        display: 'none',
      },
    }),

    // Borderless buttons are not chonky
    ...((p.borderless || type === 'transparent' || type === 'link') && {
      border: 'none',
      transform: 'translateY(0px)',

      '&::before': {
        display: 'none',
      },
      '&::after': {
        display: 'none',
      },

      '&:focus-visible': {
        ...p.theme.focusRing,
      },

      '> span:last-child': {
        transform: 'translateY(0px)',
      },

      '&:hover': {
        '> span:last-child': {
          transform: 'translateY(0px)',
        },
        backgroundColor: p.busy || p.disabled ? 'inherit' : p.theme.colors.gray100,
      },

      '&:active': {
        '> span:last-child': {
          transform: 'translateY(0px)',
        },

        backgroundColor: p.busy || p.disabled ? 'inherit' : p.theme.colors.gray200,
      },
    }),

    ...(p.priority === 'link' && {
      padding: '0',
      height: 'auto',
      minHeight: 'auto',
      border: 'none',
      transform: 'translateY(0px)',

      '> span:last-child': {
        color: 'inherit',
      },

      '&:hover': {
        '> span:last-child': {
          transform: 'translateY(0px)',
        },
      },
    }),
  };
}

function computeBackground(theme: DO_NOT_USE_ChonkTheme, baseColor: string) {
  const input = color(baseColor).hsl();

  return theme.type === 'dark'
    ? color.hsl(input.hue(), input.saturationl() * 0.1, input.lightness() * 0.1).hex()
    : color.hsl(input.hue(), input.saturationl() * 0.75, input.lightness() * 0.75).hex();
}

function getChonkButtonTheme(type: ChonkButtonType, theme: DO_NOT_USE_ChonkTheme) {
  switch (type) {
    case 'default':
      return {
        surface: theme.colors.surface500,
        background: computeBackground(theme, theme.colors.surface500),
        color: theme.colors.gray800,
      };
    case 'accent':
      return {
        surface: theme.colors.chonk.blue400,
        background: computeBackground(theme, theme.colors.chonk.blue400),
        color: theme.colors.white,
      };
    case 'warning':
      return {
        surface: theme.colors.chonk.yellow400,
        background: computeBackground(theme, theme.colors.chonk.yellow400),
        color: theme.colors.black,
      };
    case 'danger':
      return {
        surface: theme.colors.chonk.red400,
        background: computeBackground(theme, theme.colors.chonk.red400),
        color: theme.colors.white,
      };
    case 'transparent':
      return {
        surface: 'transparent',
        background: 'transparent',
        color: theme.colors.gray800,
      };
    case 'link':
      return {
        surface: 'transparent',
        background: 'transparent',
        color: theme.linkColor,
      };
    default:
      return {};
  }
}

function getChonkButtonSizeTheme(
  size: ButtonProps['size'],
  theme: DO_NOT_USE_ChonkTheme
): StrictCSSObject {
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
