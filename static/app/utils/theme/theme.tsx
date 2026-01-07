/**
 * This file is the source of truth for the theme,
 * it is roughly split into the following sections:
 *
 * - Theme helpers (color generation and aliases)
 * - Common type definitions for certain fields like button kinds and variants
 * - Light and dark theme definitions
 * - Theme type exports
 */
import type {CSSProperties} from 'react';
import {css} from '@emotion/react';
import {spring, type Transition} from 'framer-motion';

import {withLegacyTokens, type LegacyTokens} from 'sentry/utils/theme/compat';
// eslint-disable-next-line no-restricted-imports
import {darkTheme as baseDarkTheme} from 'sentry/utils/theme/scraps/theme/dark';
// eslint-disable-next-line no-restricted-imports
import {lightTheme as baseLightTheme} from 'sentry/utils/theme/scraps/theme/light';
import {color} from 'sentry/utils/theme/scraps/tokens/color';
import {typography} from 'sentry/utils/theme/scraps/tokens/typography';

import type {
  AlertVariant,
  ButtonVariant,
  FormSize,
  LevelVariant,
  MotionDuration,
  MotionEasing,
  TagVariant,
} from './types';

type Tokens = typeof baseLightTheme.tokens | typeof baseDarkTheme.tokens;
type TokensWithLegacy = Tokens & LegacyTokens;

type MotionDefinition = Record<MotionDuration, string>;

const motionDurations: Record<MotionDuration, number> = {
  fast: 120,
  moderate: 160,
  slow: 240,
};

const motionCurves: Record<
  Exclude<MotionEasing, keyof typeof motionTransitions>,
  [number, number, number, number]
> = {
  smooth: [0.72, 0, 0.16, 1],
  snap: [0.8, -0.4, 0.5, 1],
  enter: [0.24, 1, 0.32, 1],
  exit: [0.64, 0, 0.8, 0],
};

const motionCurveWithDuration = (
  durations: Record<MotionDuration, number>,
  easing: [number, number, number, number]
): [MotionDefinition, Record<MotionDuration, Transition>] => {
  const motion: MotionDefinition = {
    fast: `${durations.fast}ms cubic-bezier(${easing.join(', ')})`,
    moderate: `${durations.moderate}ms cubic-bezier(${easing.join(', ')})`,
    slow: `${durations.slow}ms cubic-bezier(${easing.join(', ')})`,
  };

  const framerMotion: Record<MotionDuration, Transition> = {
    fast: {
      duration: durations.fast / 1000,
      ease: easing,
    },
    moderate: {
      duration: durations.moderate / 1000,
      ease: easing,
    },
    slow: {
      duration: durations.slow / 1000,
      ease: easing,
    },
  };

  return [motion, framerMotion];
};

const motionTransitions: Record<'spring', Record<MotionDuration, Transition>> = {
  spring: {
    fast: {
      type: 'spring',
      stiffness: 1400,
      damping: 50,
    },
    moderate: {
      type: 'spring',
      stiffness: 1000,
      damping: 50,
    },
    slow: {
      type: 'spring',
      stiffness: 600,
      damping: 50,
    },
  },
};

const motionTransitionWithDuration = (
  transitionDefinitions: Record<MotionDuration, Transition>
): [MotionDefinition, Record<MotionDuration, Transition>] => {
  const motion = {
    fast: `${spring({
      keyframes: [0, 1],
      ...transitionDefinitions.fast,
    })}`,
    moderate: `${spring({
      keyframes: [0, 1],
      ...transitionDefinitions.moderate,
    })}`,
    slow: `${spring({
      keyframes: [0, 1],
      ...transitionDefinitions.slow,
    })}`,
  };

  return [motion, transitionDefinitions];
};

function generateMotion() {
  const [smoothMotion, smoothFramer] = motionCurveWithDuration(
    motionDurations,
    motionCurves.smooth
  );
  const [snapMotion, snapFramer] = motionCurveWithDuration(
    motionDurations,
    motionCurves.snap
  );
  const [enterMotion, enterFramer] = motionCurveWithDuration(
    motionDurations,
    motionCurves.enter
  );
  const [exitMotion, exitFramer] = motionCurveWithDuration(
    motionDurations,
    motionCurves.exit
  );
  const [springMotion, springFramer] = motionTransitionWithDuration(
    motionTransitions.spring
  );

  return {
    smooth: smoothMotion,
    snap: snapMotion,
    enter: enterMotion,
    exit: exitMotion,
    spring: springMotion,
    framer: {
      smooth: smoothFramer,
      snap: snapFramer,
      enter: enterFramer,
      exit: exitFramer,
      spring: springFramer,
    },
  };
}

type AlertColors = Record<
  AlertVariant,
  {
    background: string;
    backgroundLight: string;
    border: string;
    borderHover: string;
    color: string;
    // @TODO(jonasbadalic): Why is textLight optional and only set on error?
    textLight?: string;
  }
>;

const generateThemeUtils = (
  tokens: Tokens,
  colors: ReturnType<typeof deprecatedColorMappings>,
  aliases: Aliases
) => ({
  tooltipUnderline: (
    underlineColor: ColorOrAlias | 'warning' | 'danger' | 'success' = 'gray300'
  ) => ({
    textDecoration: 'underline' as const,
    textDecorationThickness: '0.75px',
    textUnderlineOffset: '1.25px',
    textDecorationColor:
      underlineColor === 'warning'
        ? tokens.content.warning
        : underlineColor === 'danger'
          ? tokens.content.danger
          : underlineColor === 'success'
            ? tokens.content.success
            : // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              (colors[underlineColor] ?? aliases[underlineColor]),
    textDecorationStyle: 'dotted' as const,
  }),
  overflowEllipsis: css`
    display: block;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  // https://css-tricks.com/inclusively-hidden/
  visuallyHidden: css`
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  `,
});

const generateThemePrismVariables = (
  prismColors: typeof prismLight,
  blockBackground: string
) =>
  // eslint-disable-next-line @emotion/syntax-preference
  css({
    // block background differs based on light/dark mode
    '--prism-block-background': blockBackground,
    ...prismColors,
  });

const generateButtonTheme = (
  colors: Colors,
  alias: Aliases,
  tokens: Tokens
): ButtonColors => ({
  default: {
    // all alias-based, already derived from new theme
    color: tokens.content.primary,
    colorActive: tokens.content.primary,
    background: alias.background,
    backgroundActive: alias.hover,
    border: alias.border,
    borderActive: alias.border,
    borderTranslucent: alias.translucentBorder,
    focusBorder: alias.focusBorder,
    focusShadow: alias.focus,
  },
  primary: {
    color: colors.white,
    colorActive: colors.white,
    background: colors.blue400,
    backgroundActive: colors.blue500,
    border: colors.blue400,
    borderActive: colors.blue400,
    borderTranslucent: colors.blue400,
    focusBorder: alias.focusBorder,
    focusShadow: alias.focus,
  },
  danger: {
    color: colors.white,
    colorActive: colors.white,
    background: colors.red400,
    backgroundActive: colors.red500,
    border: colors.red400,
    borderActive: colors.red400,
    borderTranslucent: colors.red400,
    focusBorder: colors.red400,
    focusShadow: colors.red200,
  },
  link: {
    color: alias.linkColor,
    colorActive: alias.linkHoverColor,
    background: 'transparent',
    backgroundActive: 'transparent',
    border: 'transparent',
    borderActive: 'transparent',
    borderTranslucent: 'transparent',
    focusBorder: alias.focusBorder,
    focusShadow: alias.focus,
  },
  disabled: {
    color: alias.disabled,
    colorActive: alias.disabled,
    background: alias.background,
    backgroundActive: alias.background,
    border: alias.disabledBorder,
    borderActive: alias.disabledBorder,
    borderTranslucent: tokens.border.transparent.neutral.muted,
    focusBorder: 'transparent',
    focusShadow: 'transparent',
  },
  transparent: {
    color: tokens.content.primary,
    colorActive: tokens.content.primary,
    background: 'transparent',
    backgroundActive: 'transparent',
    border: 'transparent',
    borderActive: 'transparent',
    borderTranslucent: 'transparent',
    focusBorder: 'transparent',
    focusShadow: 'transparent',
  },
});

const generateAlertTheme = (colors: Colors, alias: Aliases): AlertColors => ({
  info: {
    border: colors.blue200,
    background: colors.blue400,
    color: colors.blue500,
    backgroundLight: colors.blue100,
    borderHover: colors.blue400,
  },
  success: {
    background: colors.green400,
    backgroundLight: colors.green100,
    border: colors.green200,
    borderHover: colors.green400,
    color: colors.green500,
  },
  muted: {
    background: colors.gray200,
    backgroundLight: alias.backgroundSecondary,
    border: alias.border,
    borderHover: alias.border,
    color: 'inherit',
  },
  warning: {
    background: colors.yellow400,
    backgroundLight: colors.yellow100,
    border: colors.yellow200,
    borderHover: colors.yellow400,
    color: colors.yellow500,
  },
  danger: {
    background: colors.red400,
    backgroundLight: colors.red100,
    border: colors.red200,
    borderHover: colors.red400,
    color: colors.red500,
    textLight: colors.red200,
  },
});

const generateLevelTheme = (tokens: Tokens, mode: 'light' | 'dark'): LevelColors => ({
  sample: tokens.dataviz.semantic.accent,
  info: tokens.dataviz.semantic.accent,
  // BAD: accessing named colors is forbidden
  // but necessary to differente from orange
  warning: color.categorical[mode].yellow,
  // BAD: hardcoded legacy color! We no longer use orange in the main UI,
  // but do have it in the chart palette. This needs to be harcoded
  // because existing users still associate orange with the "error" level.
  error: color.categorical[mode].orange,
  fatal: tokens.dataviz.semantic.bad,
  default: tokens.dataviz.semantic.neutral,
  unknown: tokens.dataviz.semantic.other,
});

const generateTagTheme = (colors: Colors): TagColors => ({
  muted: {
    background: colors.surface500,
    border: colors.gray200,
    color: colors.gray500,
  },

  promotion: {
    background: colors.pink100,
    border: colors.pink100,
    color: colors.pink500,
  },

  warning: {
    background: colors.yellow100,
    border: colors.yellow100,
    color: colors.yellow500,
  },

  success: {
    background: colors.green100,
    border: colors.green100,
    color: colors.green500,
  },

  danger: {
    background: colors.red100,
    border: colors.red100,
    color: colors.red500,
  },

  info: {
    background: colors.blue100,
    border: colors.blue100,
    color: colors.blue500,
  },
});

/**
 * Theme definition
 */

type Colors = typeof lightColors;

type TagColors = Record<
  TagVariant,
  {
    background: string;
    border: string;
    color: string;
  }
>;

type LevelColors = Record<LevelVariant, string>;

type ButtonColors = Record<
  ButtonVariant,
  {
    background: string;
    backgroundActive: string;
    border: string;
    borderActive: string;
    borderTranslucent: string;
    color: string;
    colorActive: string;
    focusBorder: string;
    focusShadow: string;
  }
>;

const legacyTypography = {
  fontSize: typography.font.size,
  fontWeight: {
    normal: typography.font.weight.sans.regular,
    bold: typography.font.weight.sans.medium,
  },
  text: {
    family: typography.font.family.sans,
    familyMono: typography.font.family.mono,
    lineHeightHeading: typography.font.lineHeight.default,
    lineHeightBody: typography.font.lineHeight.comfortable,
  },
} as const;

type FormTheme = {
  form: Record<
    FormSize,
    {
      borderRadius: string;
      fontSize: string;
      height: string;
      lineHeight: string;
      minHeight: string;
      paddingBottom: number;
      paddingLeft: number;
      paddingRight: number;
      paddingTop: number;
    }
  >;
};
const formTheme: FormTheme = {
  /**
   * Common styles for form inputs & buttons, separated by size.
   * Should be used to ensure consistent sizing among form elements.
   */
  form: {
    md: {
      height: '36px',
      minHeight: '36px',
      fontSize: '0.875rem',
      lineHeight: '1rem',
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 12,
      paddingBottom: 12,
      borderRadius: baseLightTheme.radius.lg,
    },
    sm: {
      height: '32px',
      minHeight: '32px',
      fontSize: '0.875rem',
      lineHeight: '1rem',
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 8,
      paddingBottom: 8,
      borderRadius: baseLightTheme.radius.md,
    },
    xs: {
      height: '28px',
      minHeight: '28px',
      fontSize: '0.75rem',
      lineHeight: '1rem',
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 6,
      paddingBottom: 6,
      borderRadius: baseLightTheme.radius.sm,
    },
  },
};

/**
 * Values shared between light and dark theme
 */
const commonTheme = {
  motion: generateMotion(),

  // Try to keep these ordered plz
  zIndex: {
    // Generic z-index when you hope your component is isolated and
    // does not need to battle others for z-index priority
    initial: 1,
    truncationFullValue: 10,

    // @TODO(jonasbadalic) This should exist on traceView component
    traceView: {
      spanTreeToggler: 900,
      dividerLine: 909,
      rowInfoMessage: 910,
      minimapContainer: 999,
    },

    header: 1000,
    errorMessage: 1000,
    dropdown: 1001,

    dropdownAutocomplete: {
      // needs to be below actor but above other page elements (e.g. pagination)
      // (e.g. Issue Details "seen" dots on chart is 2)
      // stream header is 1000
      menu: 1007,
      // needs to be above menu
      // @TODO(jonasbadalic) why does it need to be above menu?
      actor: 1008,
    },

    globalSelectionHeader: 1009,

    // needs to be below sidebar
    // @TODO(jonasbadalic) why does it need to be below sidebar?
    widgetBuilderDrawer: 1016,

    settingsSidebarNavMask: 1017,
    settingsSidebarNav: 1018,
    sidebarPanel: 1019,
    sidebar: 1020,
    orgAndUserMenu: 1030,

    // Sentry user feedback modal
    sentryErrorEmbed: 1090,

    // If you change modal also update shared-components.less
    // as the z-index for bootstrap modals lives there.
    drawer: 9999,
    modal: 10000,
    toast: 10001,

    // tooltips and hovercards can be inside modals sometimes.
    hovercard: 10002,
    tooltip: 10003,

    tour: {
      blur: 10100,
      element: 10101,
      overlay: 10102,
    },

    // On mobile views issue list dropdowns overlap
    issuesList: {
      stickyHeader: 2,
      sortOptions: 3,
      displayOptions: 4,
    },
  },

  ...legacyTypography,
  ...typography,
  ...formTheme,
};

export type Color = keyof ReturnType<typeof deprecatedColorMappings>;
type Aliases = typeof lightAliases;
/**
 * Do not use this type. Use direct colors access via theme.colors or encapsulate
 * colors into human readable variants that signify the color's purpose.
 * @deprecated
 */
export type ColorOrAlias = keyof Aliases | Color;
export interface SentryTheme
  extends Omit<typeof lightThemeDefinition, 'chart' | 'tokens'> {
  chart: {
    colors: typeof CHART_PALETTE_LIGHT | typeof CHART_PALETTE_DARK;
    getColorPalette: ReturnType<typeof makeChartColorPalette>;
    neutral: string;
  };
  tokens: TokensWithLegacy;
}

const ccl = color.categorical.light;

const CHART_PALETTE_LIGHT = [
  [ccl.blurple],
  [ccl.blurple, ccl.indigo],
  [ccl.blurple, ccl.indigo, ccl.pink],
  [ccl.blurple, ccl.indigo, ccl.pink, ccl.orange],
  [ccl.blurple, ccl.indigo, ccl.pink, ccl.orange, ccl.yellow],
  [ccl.blurple, ccl.indigo, ccl.pink, ccl.orange, ccl.yellow, ccl.green],
  [ccl.blurple, ccl.purple, ccl.indigo, ccl.pink, ccl.orange, ccl.yellow, ccl.green],
  [
    ccl.blurple,
    ccl.purple,
    ccl.indigo,
    ccl.plum,
    ccl.pink,
    ccl.orange,
    ccl.yellow,
    ccl.green,
  ],
  [
    ccl.blurple,
    ccl.purple,
    ccl.indigo,
    ccl.plum,
    ccl.magenta,
    ccl.pink,
    ccl.orange,
    ccl.yellow,
    ccl.green,
  ],
  [
    ccl.blurple,
    ccl.purple,
    ccl.indigo,
    ccl.plum,
    ccl.magenta,
    ccl.pink,
    ccl.salmon,
    ccl.orange,
    ccl.yellow,
    ccl.green,
  ],
  [
    ccl.blurple,
    ccl.purple,
    ccl.indigo,
    ccl.plum,
    ccl.magenta,
    ccl.pink,
    ccl.salmon,
    ccl.orange,
    ccl.yellow,
    ccl.lime,
    ccl.green,
  ],
  [
    ccl.blurple,
    ccl.purple,
    ccl.indigo,
    ccl.plum,
    ccl.magenta,
    ccl.pink,
    ccl.salmon,
    ccl.orange,
    ccl.yellow,
    ccl.lime,
    ccl.green,
    ccl.blurple,
  ],
  [
    ccl.blurple,
    ccl.purple,
    ccl.indigo,
    ccl.plum,
    ccl.magenta,
    ccl.pink,
    ccl.salmon,
    ccl.orange,
    ccl.yellow,
    ccl.lime,
    ccl.green,
    ccl.blurple,
    ccl.purple,
  ],
  [
    ccl.blurple,
    ccl.purple,
    ccl.indigo,
    ccl.plum,
    ccl.magenta,
    ccl.pink,
    ccl.salmon,
    ccl.orange,
    ccl.yellow,
    ccl.lime,
    ccl.green,
    ccl.blurple,
    ccl.purple,
    ccl.indigo,
  ],
  [
    ccl.blurple,
    ccl.purple,
    ccl.indigo,
    ccl.plum,
    ccl.magenta,
    ccl.pink,
    ccl.salmon,
    ccl.orange,
    ccl.yellow,
    ccl.lime,
    ccl.green,
    ccl.blurple,
    ccl.purple,
    ccl.indigo,
    ccl.plum,
  ],
  [
    ccl.blurple,
    ccl.purple,
    ccl.indigo,
    ccl.plum,
    ccl.magenta,
    ccl.pink,
    ccl.salmon,
    ccl.orange,
    ccl.yellow,
    ccl.lime,
    ccl.green,
    ccl.blurple,
    ccl.purple,
    ccl.indigo,
    ccl.plum,
    ccl.magenta,
  ],
  [
    ccl.blurple,
    ccl.purple,
    ccl.indigo,
    ccl.plum,
    ccl.magenta,
    ccl.pink,
    ccl.salmon,
    ccl.orange,
    ccl.yellow,
    ccl.lime,
    ccl.green,
    ccl.blurple,
    ccl.purple,
    ccl.indigo,
    ccl.plum,
    ccl.magenta,
    ccl.pink,
  ],
  [
    ccl.blurple,
    ccl.purple,
    ccl.indigo,
    ccl.plum,
    ccl.magenta,
    ccl.pink,
    ccl.salmon,
    ccl.orange,
    ccl.yellow,
    ccl.lime,
    ccl.green,
    ccl.blurple,
    ccl.purple,
    ccl.indigo,
    ccl.plum,
    ccl.magenta,
    ccl.pink,
    ccl.salmon,
  ],
] as const;

const ccd = color.categorical.dark;

const CHART_PALETTE_DARK = [
  [ccd.blurple],
  [ccd.blurple, ccd.purple],
  [ccd.blurple, ccd.purple, ccd.pink],
  [ccd.blurple, ccd.purple, ccd.pink, ccd.orange],
  [ccd.blurple, ccd.purple, ccd.pink, ccd.orange, ccd.yellow],
  [ccd.blurple, ccd.purple, ccd.pink, ccd.orange, ccd.yellow, ccd.green],
  [ccd.blurple, ccd.purple, ccd.indigo, ccd.pink, ccd.orange, ccd.yellow, ccd.green],
  [
    ccd.blurple,
    ccd.purple,
    ccd.indigo,
    ccd.plum,
    ccd.pink,
    ccd.orange,
    ccd.yellow,
    ccd.green,
  ],
  [
    ccd.blurple,
    ccd.purple,
    ccd.indigo,
    ccd.plum,
    ccd.magenta,
    ccd.pink,
    ccd.orange,
    ccd.yellow,
    ccd.green,
  ],
  [
    ccd.blurple,
    ccd.purple,
    ccd.indigo,
    ccd.plum,
    ccd.magenta,
    ccd.pink,
    ccd.salmon,
    ccd.orange,
    ccd.yellow,
    ccd.green,
  ],
  [
    ccd.blurple,
    ccd.purple,
    ccd.indigo,
    ccd.plum,
    ccd.magenta,
    ccd.pink,
    ccd.salmon,
    ccd.orange,
    ccd.yellow,
    ccd.lime,
    ccd.green,
  ],
  [
    ccd.blurple,
    ccd.purple,
    ccd.indigo,
    ccd.plum,
    ccd.magenta,
    ccd.pink,
    ccd.salmon,
    ccd.orange,
    ccd.yellow,
    ccd.lime,
    ccd.green,
    ccd.blurple,
  ],
  [
    ccd.blurple,
    ccd.purple,
    ccd.indigo,
    ccd.plum,
    ccd.magenta,
    ccd.pink,
    ccd.salmon,
    ccd.orange,
    ccd.yellow,
    ccd.lime,
    ccd.green,
    ccd.blurple,
    ccd.purple,
  ],
  [
    ccd.blurple,
    ccd.purple,
    ccd.indigo,
    ccd.plum,
    ccd.magenta,
    ccd.pink,
    ccd.salmon,
    ccd.orange,
    ccd.yellow,
    ccd.lime,
    ccd.green,
    ccd.blurple,
    ccd.purple,
    ccd.indigo,
  ],
  [
    ccd.blurple,
    ccd.purple,
    ccd.indigo,
    ccd.plum,
    ccd.magenta,
    ccd.pink,
    ccd.salmon,
    ccd.orange,
    ccd.yellow,
    ccd.lime,
    ccd.green,
    ccd.blurple,
    ccd.purple,
    ccd.indigo,
    ccd.plum,
  ],
  [
    ccd.blurple,
    ccd.purple,
    ccd.indigo,
    ccd.plum,
    ccd.magenta,
    ccd.pink,
    ccd.salmon,
    ccd.orange,
    ccd.yellow,
    ccd.lime,
    ccd.green,
    ccd.blurple,
    ccd.purple,
    ccd.indigo,
    ccd.plum,
    ccd.magenta,
  ],
  [
    ccd.blurple,
    ccd.purple,
    ccd.indigo,
    ccd.plum,
    ccd.magenta,
    ccd.pink,
    ccd.salmon,
    ccd.orange,
    ccd.yellow,
    ccd.lime,
    ccd.green,
    ccd.blurple,
    ccd.purple,
    ccd.indigo,
    ccd.plum,
    ccd.magenta,
    ccd.pink,
  ],
  [
    ccd.blurple,
    ccd.purple,
    ccd.indigo,
    ccd.plum,
    ccd.magenta,
    ccd.pink,
    ccd.salmon,
    ccd.orange,
    ccd.yellow,
    ccd.lime,
    ccd.green,
    ccd.blurple,
    ccd.purple,
    ccd.indigo,
    ccd.plum,
    ccd.magenta,
    ccd.pink,
    ccd.salmon,
  ],
] as const;

type ChartColorPalette = typeof CHART_PALETTE_LIGHT | typeof CHART_PALETTE_DARK;
type ColorLength = (typeof CHART_PALETTE_LIGHT | typeof CHART_PALETTE_DARK)['length'];

// eslint-disable-next-line @typescript-eslint/no-restricted-types
type TupleOf<N extends number, A extends unknown[] = []> = A['length'] extends N
  ? A
  : TupleOf<N, [...A, A['length']]>;

type ValidLengthArgument = TupleOf<ColorLength>[number];

/**
 * Returns the color palette for a given number of series.
 * If length argument is statically analyzable, the return type will be narrowed
 * to the specific color palette index.
 * @TODO(jonasbadalic) Clarify why we return length+1. For a given length of 1, we should
 * return a single color, not two colors. It smells like either a bug or off by one error.
 * @param length - The number of series to return a color palette for?
 */
function makeChartColorPalette<T extends ChartColorPalette>(
  palette: T
): <Length extends ValidLengthArgument>(length: Length | number) => T[Length] {
  return function getChartColorPalette<Length extends ValidLengthArgument>(
    length: Length | number
  ): T[Length] {
    // @TODO(jonasbadalic) we guarantee type safety and sort of guarantee runtime safety by clamping and
    // the palette is not sparse, but we should probably add a runtime check here as well.
    const index = Math.max(0, Math.min(palette.length - 1, length));
    return palette[index] as T[Length];
  };
}

const lightColors = {
  black: color.black,
  white: color.white,

  surface500: color.white, // background.primary
  surface400: color.neutral.light.opaque100, // background.secondary
  surface300: color.neutral.light.opaque200, // background.tertiary
  surface200: color.neutral.light.opaque300, // border.muted
  surface100: color.neutral.light.opaque400, // border.primary

  gray800: color.neutral.light.opaque1400, // content.primary
  gray700: color.neutral.light.opaque1300, // ⚠ link.muted.active only
  gray600: color.neutral.light.opaque1200, // ⚠ link.muted.hover only
  gray500: color.neutral.light.opaque1100, // content.secondary, link.muted.default
  gray400: color.neutral.light.opaque1000, // graphics.muted
  gray300: color.neutral.light.transparent400,
  gray200: color.neutral.light.transparent300,
  gray100: color.neutral.light.transparent200,

  blue700: color.blue.light.opaque1300, // ⚠ link.accent.active only
  blue600: color.blue.light.opaque1200, // ⚠ link.accent.hover only
  blue500: color.blue.light.opaque1100, // content.accent, link.accent.default
  blue400: color.blue.light.opaque1000, // graphics.muted, border.accent
  blue300: color.blue.light.transparent400,
  blue200: color.blue.light.transparent300,
  blue100: color.blue.light.transparent200,

  pink700: color.pink.light.opaque1300, // ⚠ link.promotion.active only
  pink600: color.pink.light.opaque1200, // ⚠ link.promotion.hover only
  pink500: color.pink.light.opaque1100, // content.promotion, link.promotion.default
  pink400: color.pink.light.opaque1000, // graphics.promotion, border.promotion
  pink300: color.pink.light.transparent400,
  pink200: color.pink.light.transparent300,
  pink100: color.pink.light.transparent200,

  red700: color.red.light.opaque1300, // ⚠ link.danger.active only
  red600: color.red.light.opaque1200, // ⚠ link.danger.hover only
  red500: color.red.light.opaque1100, // ⚠ content.danger, link.danger.default
  red400: color.red.light.opaque1000, // graphics.danger, border.danger
  red300: color.red.light.transparent400,
  red200: color.red.light.transparent300,
  red100: color.red.light.transparent200,

  yellow700: color.yellow.light.opaque1300, // ⚠ link.warning.active only
  yellow600: color.yellow.light.opaque1200, // ⚠ link.warning.hover only
  yellow500: color.yellow.light.opaque1100, // content.warning, link.warning.default
  yellow400: color.yellow.light.opaque800, // graphics.warning, border.warning
  yellow300: color.yellow.light.transparent400,
  yellow200: color.yellow.light.transparent300,
  yellow100: color.yellow.light.transparent200,

  green700: color.green.light.opaque1300, // ⚠ link.success.active only
  green600: color.green.light.opaque1200, // ⚠ link.success.hover only
  green500: color.green.light.opaque1100, // content.success, link.success.default
  green400: color.green.light.opaque1000, // graphics.success, border.success
  green300: color.green.light.transparent400,
  green200: color.green.light.transparent300,
  green100: color.green.light.transparent200,

  // Currently used for avatars, badges, booleans, buttons, checkboxes, radio buttons
  chonk: {
    blue400: color.blue.light.opaque1000,
    pink400: color.pink.light.opaque800,
    red400: color.red.light.opaque1000,
    yellow400: color.yellow.light.opaque600,
    green400: color.green.light.opaque800,
  },
};

const darkColors: Colors = {
  black: color.black,
  white: color.white,

  surface500: color.neutral.dark.opaque500, // background.primary
  surface400: color.neutral.dark.opaque400, // background.secondary
  surface300: color.neutral.dark.opaque300, // background.teritary
  surface200: color.neutral.dark.opaque200, // border.muted
  surface100: color.neutral.dark.opaque100, // border.primary

  gray800: color.neutral.dark.opaque1500, // content.primary
  gray700: color.neutral.dark.opaque1400, // ⚠ link.muted.active only
  gray600: color.neutral.dark.opaque1300, // ⚠ link.muted.hover only
  gray500: color.neutral.dark.opaque1200, // content.secondary, link.muted.default
  gray400: color.neutral.dark.opaque1100, // // graphics.muted
  gray300: color.neutral.dark.transparent400,
  gray200: color.neutral.dark.transparent300,
  gray100: color.neutral.dark.transparent200,

  blue700: color.blue.dark.opaque1400, // ⚠ link.accent.active only
  blue600: color.blue.dark.opaque1300, // ⚠ link.accent.hover only
  blue500: color.blue.dark.opaque1200, // content.accent, link.accent.default
  blue400: color.blue.dark.opaque1100, // // graphics.accent, border.accent
  blue300: color.blue.dark.transparent600,
  blue200: color.blue.dark.transparent500,
  blue100: color.blue.dark.transparent400,

  pink700: color.pink.dark.opaque1400, // ⚠ link.promotion.active only
  pink600: color.pink.dark.opaque1300, // ⚠ link.promotion.hover only
  pink500: color.pink.dark.opaque1200, // content.promotion, link.promotion.default
  pink400: color.pink.dark.opaque1100, // // graphics.promotion, border.promotion
  pink300: color.pink.dark.transparent400,
  pink200: color.pink.dark.transparent300,
  pink100: color.pink.dark.transparent200,

  red700: color.red.dark.opaque1400, // ⚠ link.danger.active only
  red600: color.red.dark.opaque1300, // ⚠ link.danger.hover only
  red500: color.red.dark.opaque1200, // content.danger, link.danger.default
  red400: color.red.dark.opaque1100, // // graphics.danger, border.danger
  red300: color.red.dark.transparent400,
  red200: color.red.dark.transparent300,
  red100: color.red.dark.transparent200,

  yellow700: color.yellow.dark.opaque1500, // ⚠ link.warning.active only
  yellow600: color.yellow.dark.opaque1400, // ⚠ link.warning.hover only
  yellow500: color.yellow.dark.opaque1300, // content.warning, link.warning.default
  yellow400: color.yellow.dark.opaque1200, // graphics.warning, border.warning
  yellow300: color.yellow.dark.transparent400,
  yellow200: color.yellow.dark.transparent300,
  yellow100: color.yellow.dark.transparent200,

  green700: color.green.dark.opaque1500, // ⚠ link.success.active only
  green600: color.green.dark.opaque1400, // ⚠ link.success.hover only
  green500: color.green.dark.opaque1300, // content.success, link.success.default
  green400: color.green.dark.opaque1200, // graphics.success, border.success
  green300: color.green.dark.transparent400,
  green200: color.green.dark.transparent300,
  green100: color.green.dark.transparent200,

  // Currently used for avatars, badges, booleans, buttons, checkboxes, radio buttons
  chonk: {
    blue400: color.blue.dark.opaque900,
    pink400: color.pink.dark.opaque1000,
    red400: color.red.dark.opaque900,
    yellow400: color.yellow.dark.opaque1200,
    green400: color.green.dark.opaque1100,
  },
};

// Prism colors
// @TODO(jonasbadalic): are these final?
const prismLight = {
  /**
   * NOTE: Missing Palette All together
   * COMPONENTS AFFECTED: Unknown
   * TODO: Nothing yet, Low Prio
   */
  '--prism-base': '#332B3B',
  '--prism-inline-code': '#332B3B',
  '--prism-inline-code-background': '#F5F3F7',
  '--prism-highlight-background': '#5C78A31C',
  '--prism-highlight-accent': '#5C78A344',
  '--prism-comment': '#80708F',
  '--prism-punctuation': '#332B3B',
  '--prism-property': '#18408B',
  '--prism-selector': '#177861',
  '--prism-operator': '#235CC8',
  '--prism-variable': '#332B3B',
  '--prism-function': '#235CC8',
  '--prism-keyword': '#BB3A3D',
};

// @TODO(jonasbadalic): are these final?
const prismDark = {
  /**
   * NOTE: Missing Palette All together
   * COMPONENTS AFFECTED: Unknown
   * TODO: Nothing yet, Low Prio
   */
  '--prism-base': '#D6D0DC',
  '--prism-inline-code': '#D6D0DC',
  '--prism-inline-code-background': '#18121C',
  '--prism-highlight-background': '#A8A2C31C',
  '--prism-highlight-accent': '#A8A2C344',
  '--prism-comment': '#998DA5',
  '--prism-punctuation': '#D6D0DC',
  '--prism-property': '#70A2FF',
  '--prism-selector': '#1DCDA4',
  '--prism-operator': '#70A2FF',
  '--prism-variable': '#D6D0DC',
  '--prism-function': '#70A2FF',
  '--prism-keyword': '#F8777C',
};

// @TODO(jonasbadalic): are these final?
const lightShadows = {
  dropShadowLight: '0 0 1px rgba(43, 34, 51, 0.04)',
  dropShadowMedium: '0 1px 2px rgba(43, 34, 51, 0.04)',
  dropShadowHeavy: '0 4px 24px rgba(43, 34, 51, 0.12)',
  dropShadowHeavyTop: '0 -4px 24px rgba(43, 34, 51, 0.12)',
};

// @TODO(jonasbadalic): are these final?
const darkShadows = {
  dropShadowLight: '0 0 1px rgba(10, 8, 12, 0.2)',
  dropShadowMedium: '0 1px 2px rgba(10, 8, 12, 0.2)',
  dropShadowHeavy: '0 4px 24px rgba(10, 8, 12, 0.36)',
  dropShadowHeavyTop: '0 -4px 24px rgba(10, 8, 12, 0.36)',
};

const generateAliases = (tokens: Tokens, colors: typeof lightColors) => ({
  /**
   * Text that should not have as much emphasis
   */
  subText: tokens.content.secondary,

  /**
   * Primary background color
   */
  background: tokens.background.primary,

  /**
   * Secondary background color used as a slight contrast against primary background
   */
  backgroundSecondary: tokens.background.secondary,

  /**
   * Tertiary background color used as a stronger contrast against primary background
   */
  backgroundTertiary: tokens.background.tertiary,

  /**
   * Primary border color
   */
  border: tokens.border.primary,
  translucentBorder: tokens.border.transparent.neutral.muted,

  innerBorder: tokens.border.secondary,

  /**
   * A color that denotes a "success", or something good
   */
  success: tokens.content.success,
  successText: tokens.content.success,

  /**
   * A color that denotes an error, or something that is wrong
   */
  error: tokens.content.danger,
  errorText: tokens.content.danger,

  /**
   * A color that denotes danger, for dangerous actions like deletion
   */
  danger: tokens.content.danger,
  dangerText: tokens.content.danger,

  /**
   * A color that indicates something is disabled where user can not interact or use
   * it in the usual manner (implies that there is an "enabled" state)
   * NOTE: These are largely used for form elements, which I haven't mocked in ChonkUI
   */
  disabled: colors.gray400,
  disabledBorder: colors.gray400,

  /**
   * Indicates a "hover" state. Deprecated – use `InteractionStateLayer` instead for
   * interaction (hover/press) states.
   * @deprecated
   */
  hover: colors.gray100,

  /**
   * Indicates that something is "active" or "selected"
   * NOTE: These are largely used for form elements, which I haven't mocked in ChonkUI
   */
  active: tokens.interactive.link.accent.active,
  activeHover: tokens.interactive.link.accent.hover,
  activeText: tokens.interactive.link.accent.rest,

  /**
   * Indicates that something has "focus", which is different than "active" state as it is more temporal
   * and should be a bit subtler than active
   */
  focus: tokens.border.accent.vibrant,
  focusBorder: tokens.border.accent.vibrant,

  /**
   * Link color indicates that something is clickable
   */
  linkColor: tokens.interactive.link.accent.rest,
  linkHoverColor: tokens.interactive.link.accent.hover,
  linkUnderline: tokens.interactive.link.accent.rest,
});

const lightAliases = generateAliases(baseLightTheme.tokens, lightColors);
const darkAliases = generateAliases(baseDarkTheme.tokens, darkColors);

const deprecatedColorMappings = (colors: Colors) => ({
  /** @deprecated */
  get black() {
    return colors.black;
  },
  /** @deprecated */
  get white() {
    return colors.white;
  },

  /** @deprecated */
  get gray500() {
    return colors.gray800;
  },
  /** @deprecated */
  get gray400() {
    return colors.gray500;
  },
  /** @deprecated */
  get gray300() {
    return colors.gray400;
  },
  /** @deprecated */
  get gray200() {
    return colors.gray200;
  },
  /** @deprecated */
  get gray100() {
    return colors.gray100;
  },

  /** @deprecated */
  get purple400() {
    return colors.blue500;
  },
  /** @deprecated */
  get purple300() {
    return colors.blue400;
  },
  /** @deprecated */
  get purple200() {
    return colors.blue200;
  },
  /** @deprecated */
  get purple100() {
    return colors.blue100;
  },

  /** @deprecated */
  get blue400() {
    return colors.blue500;
  },
  /** @deprecated */
  get blue300() {
    return colors.blue400;
  },
  /** @deprecated */
  get blue200() {
    return colors.blue200;
  },
  /** @deprecated */
  get blue100() {
    return colors.blue100;
  },

  /** @deprecated */
  get pink400() {
    return colors.pink500;
  },
  /** @deprecated */
  get pink300() {
    return colors.pink400;
  },
  /** @deprecated */
  get pink200() {
    return colors.pink200;
  },
  /** @deprecated */
  get pink100() {
    return colors.pink100;
  },

  /** @deprecated */
  get red400() {
    return colors.red500;
  },
  /** @deprecated */
  get red300() {
    return colors.red400;
  },
  /** @deprecated */
  get red200() {
    return colors.red200;
  },
  /** @deprecated */
  get red100() {
    return colors.red100;
  },

  /** @deprecated */
  get yellow400() {
    return colors.yellow500;
  },
  /** @deprecated */
  get yellow300() {
    return colors.yellow400;
  },
  /** @deprecated */
  get yellow200() {
    return colors.yellow200;
  },
  /** @deprecated */
  get yellow100() {
    return colors.yellow100;
  },

  /** @deprecated */
  get green400() {
    return colors.green500;
  },
  /** @deprecated */
  get green300() {
    return colors.green400;
  },
  /** @deprecated */
  get green200() {
    return colors.green200;
  },
  /** @deprecated */
  get green100() {
    return colors.green100;
  },
});

const lightThemeDefinition = {
  type: 'light' as 'light' | 'dark',
  // @TODO: color theme contains some colors (like chart color palette, diff, tag and level)
  ...commonTheme,
  ...deprecatedColorMappings(lightColors),
  ...baseLightTheme,
  ...lightAliases,
  ...lightShadows,
  // @TODO: remove backwards-compatability shim
  tokens: withLegacyTokens(baseLightTheme.tokens),
  focusRing: (baseShadow = `0 0 0 0 ${lightAliases.background}`) => ({
    outline: 'none',
    boxShadow: `${baseShadow}, 0 0 0 2px ${lightAliases.focusBorder}`,
  }),

  // @TODO: these colors need to be ported
  ...generateThemeUtils(
    baseLightTheme.tokens,
    deprecatedColorMappings(lightColors),
    lightAliases
  ),
  alert: generateAlertTheme(lightColors, lightAliases),
  button: generateButtonTheme(lightColors, lightAliases, baseLightTheme.tokens),
  tag: generateTagTheme(lightColors),
  level: generateLevelTheme(baseLightTheme.tokens, 'light'),

  chart: {
    neutral: baseLightTheme.tokens.dataviz.semantic.neutral,
    colors: CHART_PALETTE_LIGHT,
    getColorPalette: makeChartColorPalette(CHART_PALETTE_LIGHT),
  },

  prismVariables: generateThemePrismVariables(
    prismLight,
    lightAliases.backgroundSecondary
  ),
  prismDarkVariables: generateThemePrismVariables(
    prismDark,
    baseDarkTheme.tokens.background.primary
  ),

  colors: lightColors,
};

/**
 * @deprecated use useTheme hook instead of directly importing the theme. If you require a theme for your tests, use ThemeFixture.
 */
export const lightTheme: SentryTheme = lightThemeDefinition;

/**
 * @deprecated use useTheme hook instead of directly importing the theme. If you require a theme for your tests, use ThemeFixture.
 */
export const darkTheme: SentryTheme = {
  type: 'dark',
  // @TODO: color theme contains some colors (like chart color palette, diff, tag and level)
  ...commonTheme,

  ...deprecatedColorMappings(darkColors),
  ...baseDarkTheme,
  ...darkAliases,
  ...darkShadows,
  // @TODO: remove backwards-compatability shim
  tokens: withLegacyTokens(baseDarkTheme.tokens),
  focusRing: (baseShadow = `0 0 0 0 ${darkAliases.background}`) => ({
    outline: 'none',
    boxShadow: `${baseShadow}, 0 0 0 2px ${darkAliases.focusBorder}`,
  }),

  // @TODO: these colors need to be ported
  ...generateThemeUtils(
    baseDarkTheme.tokens,
    deprecatedColorMappings(darkColors),
    darkAliases
  ),
  alert: generateAlertTheme(darkColors, darkAliases),
  button: generateButtonTheme(darkColors, darkAliases, baseDarkTheme.tokens),
  tag: generateTagTheme(darkColors),
  level: generateLevelTheme(baseDarkTheme.tokens, 'dark'),

  chart: {
    neutral: baseDarkTheme.tokens.dataviz.semantic.neutral,
    colors: CHART_PALETTE_DARK,
    getColorPalette: makeChartColorPalette(CHART_PALETTE_DARK),
  },

  prismVariables: generateThemePrismVariables(prismDark, darkAliases.backgroundSecondary),
  prismDarkVariables: generateThemePrismVariables(
    prismDark,
    baseDarkTheme.tokens.background.primary
  ),

  colors: darkColors,
};

declare module '@emotion/react' {
  /**
   * Configure Emotion to use our theme
   */
  export interface Theme extends SentryTheme {}
}

export type StrictCSSObject = {
  [K in keyof CSSProperties]?: CSSProperties[K]; // Enforce standard CSS properties
} & Partial<{
  [key: `&${string}`]: StrictCSSObject; // Allow nested selectors
  [key: `> ${string}:last-child`]: StrictCSSObject; // Allow some nested selectors
  [key: `> ${string}:first-child`]: StrictCSSObject; // Allow some nested selectors
}>;
