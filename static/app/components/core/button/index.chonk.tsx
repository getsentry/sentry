import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';

import type {ButtonProps} from 'sentry/components/core/button';
import {space} from 'sentry/styles/space';
import type {StrictCSSObject} from 'sentry/utils/theme';

// @TODO: remove Link type in the future
type ChonkButtonType =
  | 'default'
  | 'transparent'
  | 'accent'
  | 'warning'
  | 'danger'
  | 'link';
type ChonkButtonSize = 'mini' | 'small' | 'medium' | 'large';

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

function chonkSizeMapping(size: ButtonProps['size']): ChonkButtonSize {
  switch (size) {
    case 'zero':
      return 'mini';
    case 'xs':
      return 'small';
    case 'sm':
      return 'medium';
    case 'md':
      return 'large';
    default:
      return 'medium';
  }
}

export function getChonkButtonStyles(
  p: ButtonProps & {theme: DO_NOT_USE_ChonkTheme}
): StrictCSSObject {
  const type = chonkPriorityToType(p.priority);
  const size = chonkSizeMapping(p.size);

  const translate = size === 'medium' || size === 'small' ? 4 : 3;

  return {
    position: 'relative',
    display: 'inline-block',
    fontWeight: p.theme.fontWeightBold,

    cursor: p.disabled ? 'not-allowed' : 'pointer',
    opacity: p.busy || p.disabled ? 0.6 : undefined,

    padding: getChonkButtonSizeTheme(size, p.theme).padding,
    borderRadius: getChonkButtonSizeTheme(size, p.theme).borderRadius,
    color: getChonkButtonTheme(type, p.theme).color,

    border: '1px solid transparent',
    borderTopWidth: `3px`,
    background: 'none',

    minHeight:
      size === 'large'
        ? '37px'
        : size === 'medium'
          ? '30px'
          : size === 'small'
            ? '25px'
            : '20px',

    fontSize: size === 'small' || size === 'mini' ? '12px' : '14px',

    '&::before': {
      content: '""',
      display: 'block',
      position: 'absolute',
      inset: '-1px',
      bottom: '2px',
      boxShadow: `0 3px 0 0px ${getChonkButtonTheme(type, p.theme).background}, inset 0px -1px 0 0px ${getChonkButtonTheme(type, p.theme).background}`,
      borderRadius: 'inherit',
    },

    '&::after': {
      content: '""',
      display: 'block',
      position: 'absolute',
      top: '-1px',
      left: '-1px',
      right: '-1px',
      bottom: '-1px',
      background: getChonkButtonTheme(type, p.theme).surface,
      borderRadius: 'inherit',
      border: `1px solid ${getChonkButtonTheme(type, p.theme).background}`,
      transform: 'translateY(-2px)',
      transition: 'transform 0.1s ease-in-out',
    },

    '&:focus-visible': {
      ...p.theme.focusRing,
    },

    '> span:last-child': {
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      whiteSpace: 'nowrap',
      transform: 'translateY(-2px)',
      transition: 'transform 0.06s ease-in-out',
    },

    '&:hover': {
      color: getChonkButtonTheme(type, p.theme).color,

      '&::after': {
        transform: `translateY(-${translate}px)`,
      },
      '> span:last-child': {
        transform: `translateY(-${translate}px)`,
      },
    },

    '&:active': {
      '&::after': {
        transform: 'translateY(0px)',
      },
      '> span:last-child': {
        transform: 'translateY(0px)',
      },
    },

    '&:disabled': {
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

    // Borderdless buttons are not chonky
    ...((p.borderless || type === 'transparent' || type === 'link') && {
      border: 'none',

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

        backgroundColor: p.theme.colors.gray100,
      },

      '&:active': {
        '> span:last-child': {
          transform: 'translateY(0px)',
        },

        backgroundColor: p.theme.colors.gray200,
      },
    }),

    ...(p.priority === 'link' && {
      padding: '0',
      height: 'auto',
      minHeight: 'auto',
      border: 'none',

      '> span:last-child': {
        color: 'inherit',
      },

      '&:hover': {
        '> span:last-child': {
          transform: 'translateY(0px)',
        },
      },
    }),

    ...(p.size === 'zero' && {
      height: 'auto',
      minHeight: 'auto',
      padding: space(0.25),
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
  size: ChonkButtonSize,
  theme: DO_NOT_USE_ChonkTheme
): StrictCSSObject {
  switch (size) {
    case 'mini':
      return {
        borderRadius: theme.radius.mini,
        padding: `${theme.space.micro} ${theme.space.mini}`,
      };
    case 'small':
      return {
        borderRadius: theme.radius.sm,
        padding: `${theme.space.mini} ${theme.space.sm}`,
      };
    case 'medium':
      return {
        borderRadius: theme.radius.md,
        padding: `${theme.space.sm} ${theme.space.md}`,
      };
    case 'large':
      return {
        borderRadius: theme.radius.lg,
        padding: `${theme.space.md} ${theme.space.lg}`,
      };
    default:
      return {};
  }
}
