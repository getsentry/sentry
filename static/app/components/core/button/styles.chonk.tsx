import type {DO_NOT_USE_ButtonProps as ButtonProps} from 'sentry/components/core/button/types';
import {chonkFor} from 'sentry/components/core/chonk';
// eslint-disable-next-line boundaries/element-types
import type {StrictCSSObject, Theme} from 'sentry/utils/theme';

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

const chonkElevation = {
  md: '2px',
  sm: '2px',
  xs: '1px',
  zero: '0px',
} satisfies Record<NonNullable<ButtonProps['size']>, string>;

const chonkHoverElevation = '1px';

export function DO_NOT_USE_getChonkButtonStyles(
  p: Pick<ButtonProps, 'priority' | 'busy' | 'disabled' | 'borderless'> & {
    size: NonNullable<ButtonProps['size']>;
    theme: Theme;
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

  const chonkButtonTheme = getChonkButtonTheme(type, p.theme);
  const elevation = chonkElevation[p.size];

  return {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',

    fontWeight: p.theme.font.weight.sans.medium,

    opacity: p.busy || p.disabled ? 0.6 : undefined,

    cursor: 'pointer',
    '&[disabled]': {
      cursor: 'not-allowed',
    },

    padding: getChonkButtonSizeTheme(p.size, p.theme).padding,
    borderRadius: getChonkButtonSizeTheme(p.size, p.theme).borderRadius,
    border: 'none',
    color: chonkButtonTheme.color,

    background: 'none',

    height: buttonSizes[p.size].height,
    minHeight: buttonSizes[p.size].minHeight,
    fontSize: buttonSizes[p.size].fontSize,
    lineHeight: buttonSizes[p.size].lineHeight,

    '&::before': {
      content: '""',
      display: 'block',
      position: 'absolute',
      inset: '0',
      height: `calc(100% - ${elevation})`,
      top: `${elevation}`,
      transform: `translateY(-${elevation})`,
      boxShadow: `0 ${elevation} 0 0px ${chonkButtonTheme.background}`,
      background: chonkButtonTheme.background,
      borderRadius: 'inherit',
    },

    '&::after': {
      content: '""',
      display: 'block',
      position: 'absolute',
      inset: '0',
      background: chonkButtonTheme.surface,
      borderRadius: 'inherit',
      border: `1px solid ${chonkButtonTheme.background}`,
      transform: `translateY(-${elevation})`,
      transition: `transform ${p.theme.motion.snap.fast}`,
    },

    '&:focus-visible': {
      outline: 'none',
      color: p.disabled || p.busy ? undefined : chonkButtonTheme.color,

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
      transform: `translateY(-${elevation})`,
      transition: `transform ${p.theme.motion.snap.fast}`,
    },

    '&:hover': {
      color: p.disabled || p.busy ? undefined : chonkButtonTheme.color,

      '&::after': {
        transform: `translateY(calc(-${elevation} - ${chonkHoverElevation}))`,
      },
      '> span:last-child': {
        transform: `translateY(calc(-${elevation} - ${chonkHoverElevation}))`,
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

    '&[aria-expanded="true"], &[aria-checked="true"]': {
      '&::after': {
        transition: 'none',
      },
      '> span:last-child': {
        transition: 'none',
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
        ...p.theme.focusRing(),
      },

      '> span:last-child': {
        transform: 'translateY(0px)',
      },

      '&:hover': {
        '> span:last-child': {
          transform: 'translateY(0px)',
        },
        backgroundColor:
          p.busy || p.disabled || type === 'link' ? 'inherit' : p.theme.colors.gray100,
      },

      '&:active': {
        '> span:last-child': {
          transform: 'translateY(0px)',
        },

        backgroundColor:
          p.busy || p.disabled || type === 'link' ? 'inherit' : p.theme.colors.gray200,
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

function getChonkButtonTheme(type: ChonkButtonType, theme: Theme) {
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
        background: chonkFor(theme, theme.colors.chonk.blue400),
        color: theme.colors.white,
      };
    case 'warning':
      return {
        surface: theme.colors.chonk.yellow400,
        background: chonkFor(theme, theme.colors.chonk.yellow400),
        color: theme.colors.black,
      };
    case 'danger':
      return {
        surface: theme.colors.chonk.red400,
        background: chonkFor(theme, theme.colors.chonk.red400),
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
        color: theme.tokens.interactive.link.accent.rest,
      };
    default:
      return {};
  }
}

function getChonkButtonSizeTheme(
  size: ButtonProps['size'],
  theme: Theme
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
