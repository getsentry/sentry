import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';

import type {ButtonProps} from 'sentry/components/core/button';
import type {StrictCSSObject} from 'sentry/utils/theme';

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
    // @ts-expect-error the previous button did not have this variant, but we still want to
    // forward it so that we can write the stories for it
    case 'transparent':
      return 'transparent';
    case 'link':
      return 'link';
    default:
      return 'default';
  }
}

export function getChonkButtonStyles(
  p: Pick<ButtonProps, 'size' | 'priority' | 'busy' | 'disabled' | 'borderless'> & {
    theme: DO_NOT_USE_ChonkTheme;
  }
): StrictCSSObject {
  const type = chonkPriorityToType(p.priority);

  return {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',

    fontWeight: p.theme.fontWeightBold,

    cursor: p.disabled ? 'not-allowed' : 'pointer',
    opacity: p.busy || p.disabled ? 0.6 : undefined,

    padding: getChonkButtonSizeTheme(p.size, p.theme).padding,
    borderRadius: getChonkButtonSizeTheme(p.size, p.theme).borderRadius,
    border: 'none',
    color: getChonkButtonTheme(type, p.theme).color,

    transform: 'translateY(2px)',
    background: 'none',

    height:
      p.size === 'md'
        ? '36px'
        : p.size === 'sm'
          ? '32px'
          : p.size === 'xs'
            ? '28px'
            : '24px',

    fontSize: p.size === 'xs' || p.size === 'zero' ? '12px' : '14px',

    '&::before': {
      content: '""',
      display: 'block',
      position: 'absolute',
      inset: '0px',
      bottom: '2px',
      boxShadow: `0 3px 0 0px ${getChonkButtonTheme(type, p.theme).background}`,
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
      transform: 'translateY(-2px)',
      transition: 'transform 0.1s ease-in-out',
    },

    '&:focus-visible': {
      '&::after': {
        ...p.theme.focusRing,
      },
    },

    '> span:last-child': {
      zIndex: 1,
      position: 'relative',

      display: 'inherit',
      alignItems: 'inherit',
      justifyContent: 'inherit',
      flex: 'inherit',
      gap: 'inherit',

      whiteSpace: 'nowrap',
      transform: 'translateY(-2px)',
      transition: 'transform 0.06s ease-in-out',
    },

    '&:hover': {
      color: p.disabled || p.busy ? undefined : getChonkButtonTheme(type, p.theme).color,

      '&::after': {
        transform: `translateY(-3px)`,
      },
      '> span:last-child': {
        transform: `translateY(-3px)`,
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
      '&::before': {
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

function getChonkButtonTheme(type: ChonkButtonType, theme: DO_NOT_USE_ChonkTheme) {
  switch (type) {
    case 'default':
      return {
        surface: theme.colors.surface500,
        background: theme.colors.surface100,
        color: theme.colors.gray800,
      };
    case 'accent':
      return {
        surface: theme.colors.chonk.blue400,
        background: theme.colors.chonk.blue100,
        color: theme.colors.white,
      };
    case 'warning':
      return {
        surface: theme.colors.chonk.yellow400,
        background: theme.colors.chonk.yellow100,
        color: theme.colors.black,
      };
    case 'danger':
      return {
        surface: theme.colors.chonk.red400,
        background: theme.colors.chonk.red100,
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
        borderRadius: theme.radius.xl,
        padding: `${theme.space.md} ${theme.space.xl}`,
      };
    case 'sm':
      return {
        borderRadius: theme.radius.lg,
        padding: `${theme.space.md} ${theme.space.lg}`,
      };
    case 'xs':
      return {
        borderRadius: theme.radius.md,
        padding: `${theme.space.sm} ${theme.space.md}`,
      };
    case 'zero':
      return {
        borderRadius: theme.radius.sm,
        padding: `${theme.space.mini} ${theme.space.sm}`,
      };
    default:
      return {};
  }
}
