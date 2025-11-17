import type React from 'react';
import {useTheme, type Theme} from '@emotion/react';
import styled, {
  type CreateStyledComponent,
  type FilteringStyledOptions,
  type StyledOptions,
} from '@emotion/styled';
import modifyColor from 'color';

import {color} from './color';
import type {ColorMapping, FormTheme, Theme as SentryTheme} from './theme';
import commonTheme, {
  darkTheme,
  generateAlertTheme,
  generateButtonTheme,
  generateLevelTheme,
  generateTagTheme,
  generateThemePrismVariables,
  generateThemeUtils,
  lightTheme,
} from './theme';
import {tokens} from './tokens';

const CHART_PALETTE_LIGHT = [
  ['#7553FF'],
  ['#7553FF', '#3A1873'],
  ['#7553FF', '#3A1873', '#F0369A'],
  ['#7553FF', '#3A1873', '#F0369A', '#FF9838'],
  ['#7553FF', '#3A1873', '#F0369A', '#FF9838', '#FFD00E'],
  ['#7553FF', '#3A1873', '#F0369A', '#FF9838', '#FFD00E', '#67C800'],
  ['#7553FF', '#5533B2', '#3A1873', '#F0369A', '#FF9838', '#FFD00E', '#67C800'],
  [
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#7C2282',
    '#F0369A',
    '#FF9838',
    '#FFD00E',
    '#67C800',
  ],
  [
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#7C2282',
    '#B82D90',
    '#F0369A',
    '#FF9838',
    '#FFD00E',
    '#67C800',
  ],
  [
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#7C2282',
    '#B82D90',
    '#F0369A',
    '#FA6769',
    '#FF9838',
    '#FFD00E',
    '#67C800',
  ],
  [
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#7C2282',
    '#B82D90',
    '#F0369A',
    '#FA6769',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
  ],
  [
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#7C2282',
    '#B82D90',
    '#F0369A',
    '#FA6769',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#7553FF',
  ],
  [
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#7C2282',
    '#B82D90',
    '#F0369A',
    '#FA6769',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#7553FF',
    '#5533B2',
  ],
  [
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#7C2282',
    '#B82D90',
    '#F0369A',
    '#FA6769',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#7553FF',
    '#5533B2',
    '#3A1873',
  ],
  [
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#7C2282',
    '#B82D90',
    '#F0369A',
    '#FA6769',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#7C2282',
  ],
  [
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#7C2282',
    '#B82D90',
    '#F0369A',
    '#FA6769',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#7C2282',
    '#B82D90',
  ],
  [
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#7C2282',
    '#B82D90',
    '#F0369A',
    '#FA6769',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#7C2282',
    '#B82D90',
    '#F0369A',
  ],
  [
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#7C2282',
    '#B82D90',
    '#F0369A',
    '#FA6769',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#7C2282',
    '#B82D90',
    '#F0369A',
    '#FA6769',
  ],
] as const;

const CHART_PALETTE_DARK = [
  ['#7553FF'],
  ['#7553FF', '#5D3EB2'],
  ['#7553FF', '#5D3EB2', '#F0369A'],
  ['#7553FF', '#5D3EB2', '#F0369A', '#FF9838'],
  ['#7553FF', '#5D3EB2', '#F0369A', '#FF9838', '#FFD00E'],
  ['#7553FF', '#5D3EB2', '#F0369A', '#FF9838', '#FFD00E', '#67C800'],
  ['#7553FF', '#5D3EB2', '#50219C', '#F0369A', '#FF9838', '#FFD00E', '#67C800'],
  [
    '#7553FF',
    '#5D3EB2',
    '#50219C',
    '#7C2282',
    '#F0369A',
    '#FF9838',
    '#FFD00E',
    '#67C800',
  ],
  [
    '#7553FF',
    '#5D3EB2',
    '#50219C',
    '#7C2282',
    '#B0009C',
    '#F0369A',
    '#FF9838',
    '#FFD00E',
    '#67C800',
  ],
  [
    '#7553FF',
    '#5D3EB2',
    '#50219C',
    '#7C2282',
    '#B0009C',
    '#F0369A',
    '#FA6769',
    '#FF9838',
    '#FFD00E',
    '#67C800',
  ],
  [
    '#7553FF',
    '#5D3EB2',
    '#50219C',
    '#7C2282',
    '#B0009C',
    '#F0369A',
    '#FA6769',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
  ],
  [
    '#7553FF',
    '#5D3EB2',
    '#50219C',
    '#7C2282',
    '#B0009C',
    '#F0369A',
    '#FA6769',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#7553FF',
  ],
  [
    '#7553FF',
    '#5D3EB2',
    '#50219C',
    '#7C2282',
    '#B0009C',
    '#F0369A',
    '#FA6769',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#7553FF',
    '#5D3EB2',
  ],
  [
    '#7553FF',
    '#5D3EB2',
    '#50219C',
    '#7C2282',
    '#B0009C',
    '#F0369A',
    '#FA6769',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#7553FF',
    '#5D3EB2',
    '#50219C',
  ],
  [
    '#7553FF',
    '#5D3EB2',
    '#50219C',
    '#7C2282',
    '#B0009C',
    '#F0369A',
    '#FA6769',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#7553FF',
    '#5D3EB2',
    '#50219C',
    '#7C2282',
  ],
  [
    '#7553FF',
    '#5D3EB2',
    '#50219C',
    '#7C2282',
    '#B0009C',
    '#F0369A',
    '#FA6769',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#7553FF',
    '#5D3EB2',
    '#50219C',
    '#7C2282',
    '#B0009C',
  ],
  [
    '#7553FF',
    '#5D3EB2',
    '#50219C',
    '#7C2282',
    '#B0009C',
    '#F0369A',
    '#FA6769',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#7553FF',
    '#5D3EB2',
    '#50219C',
    '#7C2282',
    '#B0009C',
    '#F0369A',
  ],
  [
    '#7553FF',
    '#5D3EB2',
    '#50219C',
    '#7C2282',
    '#B0009C',
    '#F0369A',
    '#FA6769',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#7553FF',
    '#5D3EB2',
    '#50219C',
    '#7C2282',
    '#B0009C',
    '#F0369A',
    '#FA6769',
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
    },
    sm: {
      height: '32px',
      minHeight: '32px',
      fontSize: '0.875rem',
      lineHeight: '1rem',
    },
    xs: {
      height: '28px',
      minHeight: '28px',
      fontSize: '0.75rem',
      lineHeight: '1rem',
    },
  },

  /**
   * Padding for form inputs
   * @TODO(jonasbadalic) This should exist on form component
   */
  formPadding: {
    md: {
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 12,
      paddingBottom: 12,
    },
    sm: {
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 8,
      paddingBottom: 8,
    },
    xs: {
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 6,
      paddingBottom: 6,
    },
  },
  formRadius: {
    md: {
      borderRadius: '8px',
    },
    sm: {
      borderRadius: '6px',
    },
    xs: {
      borderRadius: '5px',
    },
  },
  formSpacing: {
    md: '8px',
    sm: '6px',
    xs: '4px',
  },
};

// @TODO(jonasbadalic): eventually, we should port component usage to these values
// @deprecated prefer using the `tokens.tsx` file
function generateDeprecatedChonkTokens(colorScheme: typeof lightColors) {
  return {
    content: {
      primary: colorScheme.gray800,
      muted: colorScheme.gray500,
      accent: colorScheme.blue500,
      promotion: colorScheme.pink500,
      danger: colorScheme.red500,
      warning: colorScheme.yellow500,
      success: colorScheme.green500,
    },
    graphics: {
      muted: colorScheme.gray400,
      accent: colorScheme.blue400,
      promotion: colorScheme.pink400,
      danger: colorScheme.red400,
      warning: colorScheme.yellow400,
      success: colorScheme.green400,
    },
    background: {
      primary: colorScheme.surface500,
      secondary: colorScheme.surface400,
      tertiary: colorScheme.surface300,
    },
    border: {
      primary: colorScheme.surface100,
      muted: colorScheme.surface200,
      accent: colorScheme.blue400,
      promotion: colorScheme.pink400,
      danger: colorScheme.red400,
      warning: colorScheme.yellow400,
      success: colorScheme.green400,
    },
    component: {
      link: {
        muted: {
          default: colorScheme.gray500,
          hover: colorScheme.gray600,
          active: colorScheme.gray700,
        },
        accent: {
          default: colorScheme.blue500,
          hover: colorScheme.blue600,
          active: colorScheme.blue700,
        },
        promotion: {
          default: colorScheme.pink500,
          hover: colorScheme.pink600,
          active: colorScheme.pink700,
        },
        danger: {
          default: colorScheme.red500,
          hover: colorScheme.red600,
          active: colorScheme.red700,
        },
        warning: {
          default: colorScheme.yellow500,
          hover: colorScheme.yellow600,
          active: colorScheme.yellow700,
        },
        success: {
          default: colorScheme.green500,
          hover: colorScheme.green600,
          active: colorScheme.green700,
        },
      },
    },
  };
}

const radius = {
  '0': '0px',
  '2xs': '2px',
  xs: '3px',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  full: 'calc(infinity*1px)',
} as const;

const lightColors = {
  black: color.black,
  white: color.white,

  surface500: tokens.color.background.primary.light, // background.primary
  surface400: tokens.color.background.secondary.light, // background.secondary
  surface300: tokens.color.background.tertiary.light, // background.tertiary
  surface200: tokens.color.border.secondary.light, // border.muted
  surface100: tokens.color.border.primary.light, // border.primary

  gray800: tokens.color.content.primary.light, // content.primary
  gray700: color.neutral.light.opaque[1300], // ⚠ link.muted.active only
  gray600: color.neutral.light.opaque[1200], // ⚠ link.muted.hover only
  gray500: tokens.color.content.secondary.light, // content.secondary, link.muted.default
  gray400: tokens.color.graphics.neutral.muted.light, // graphics.muted
  gray300: color.neutral.light.transparent[300],
  gray200: color.neutral.light.transparent[200],
  gray100: color.neutral.light.transparent[100],

  blue700: color.blue.light.opaque[1400], // ⚠ link.accent.active only
  blue600: color.blue.light.opaque[1300], // ⚠ link.accent.hover only
  blue500: tokens.color.content.accent.light, // content.accent, link.accent.default
  blue400: tokens.color.graphics.accent.muted.light, // graphics.muted, border.accent
  blue300: color.blue.light.transparent[300],
  blue200: color.blue.light.transparent[200],
  blue100: color.blue.light.transparent[100],

  pink700: color.pink.light.opaque[1300], // ⚠ link.promotion.active only
  pink600: color.pink.light.opaque[1200], // ⚠ link.promotion.hover only
  pink500: tokens.color.content.promotion.light, // content.promotion, link.promotion.default
  pink400: tokens.color.graphics.promotion.muted.light, // graphics.promotion, border.promotion
  pink300: color.pink.light.transparent[300],
  pink200: color.pink.light.transparent[200],
  pink100: color.pink.light.transparent[100],

  red700: color.red.light.opaque[1200], // ⚠ link.danger.active only
  red600: color.red.light.opaque[1100], // ⚠ link.danger.hover only
  red500: tokens.color.content.danger.light, // ⚠ content.danger, link.danger.default
  red400: tokens.color.graphics.danger.muted.light, // graphics.danger, border.danger
  red300: color.red.light.transparent[300],
  red200: color.red.light.transparent[200],
  red100: color.red.light.transparent[100],

  yellow700: color.yellow.light.opaque[1200], // ⚠ link.warning.active only
  yellow600: color.yellow.light.opaque[1100], // ⚠ link.warning.hover only
  yellow500: tokens.color.content.warning.light, // content.warning, link.warning.default
  yellow400: tokens.color.graphics.warning.muted.light, // graphics.warning, border.warning
  yellow300: color.yellow.light.transparent[300],
  yellow200: color.yellow.light.transparent[200],
  yellow100: color.yellow.light.transparent[100],

  green700: color.green.light.opaque[1200], // ⚠ link.success.active only
  green600: color.green.light.opaque[1100], // ⚠ link.success.hover only
  green500: tokens.color.content.success.light, // content.success, link.success.default
  green400: tokens.color.graphics.success.muted.light, // graphics.success, border.success
  green300: color.green.light.transparent[300],
  green200: color.green.light.transparent[200],
  green100: color.green.light.transparent[100],

  // Currently used for avatars, badges, booleans, buttons, checkboxes, radio buttons
  chonk: {
    blue400: color.categorical.light.blurple,
    pink400: color.pink.light.opaque[400],
    red400: color.red.light.opaque[1000],
    yellow400: color.yellow.light.opaque[600],
    green400: color.green.light.opaque[800],
  },
};

const darkColors: typeof lightColors = {
  black: color.black,
  white: color.white,

  surface500: tokens.color.background.primary.dark, // background.primary
  surface400: tokens.color.background.secondary.dark, // background.secondary
  surface300: tokens.color.background.tertiary.dark, // background.teritary
  surface200: tokens.color.border.secondary.dark, // border.muted
  surface100: tokens.color.border.primary.dark, // border.primary

  gray800: tokens.color.content.primary.dark, // content.primary
  gray700: color.neutral.dark.opaque[1300], // ⚠ link.muted.active only
  gray600: color.neutral.dark.opaque[1200], // ⚠ link.muted.hover only
  gray500: tokens.color.content.secondary.dark, // content.secondary, link.muted.default
  gray400: tokens.color.graphics.neutral.muted.dark, // // graphics.muted
  gray300: color.neutral.dark.transparent[300],
  gray200: color.neutral.dark.transparent[200],
  gray100: color.neutral.dark.transparent[100],

  blue700: color.blue.dark.opaque[1400], // ⚠ link.accent.active only
  blue600: color.blue.dark.opaque[1300], // ⚠ link.accent.hover only
  blue500: tokens.color.content.accent.dark, // content.accent, link.accent.default
  blue400: tokens.color.graphics.accent.muted.dark, // // graphics.accent, border.accent
  blue300: color.blue.dark.transparent[300],
  blue200: color.blue.dark.transparent[200],
  blue100: color.blue.dark.transparent[100],

  pink700: color.pink.dark.opaque[1400], // ⚠ link.promotion.active only
  pink600: color.pink.dark.opaque[1300], // ⚠ link.promotion.hover only
  pink500: tokens.color.content.promotion.dark, // content.promotion, link.promotion.default
  pink400: tokens.color.graphics.promotion.muted.dark, // // graphics.promotion, border.promotion
  pink300: color.pink.dark.transparent[300],
  pink200: color.pink.dark.transparent[200],
  pink100: color.pink.dark.transparent[100],

  red700: color.red.dark.opaque[1400], // ⚠ link.danger.active only
  red600: color.red.dark.opaque[1300], // ⚠ link.danger.hover only
  red500: tokens.color.content.danger.dark, // content.danger, link.danger.default
  red400: tokens.color.graphics.danger.muted.dark, // // graphics.danger, border.danger
  red300: color.red.dark.transparent[300],
  red200: color.red.dark.transparent[200],
  red100: color.red.dark.transparent[100],

  yellow700: color.yellow.dark.opaque[1400], // ⚠ link.warning.active only
  yellow600: color.yellow.dark.opaque[1300], // ⚠ link.warning.hover only
  yellow500: tokens.color.content.warning.dark, // content.warning, link.warning.default
  yellow400: tokens.color.graphics.warning.muted.dark, // graphics.warning, border.warning
  yellow300: color.yellow.dark.transparent[300],
  yellow200: color.yellow.dark.transparent[200],
  yellow100: color.yellow.dark.transparent[100],

  green700: color.green.dark.opaque[1400], // ⚠ link.success.active only
  green600: color.green.dark.opaque[1300], // ⚠ link.success.hover only
  green500: tokens.color.content.success.dark, // content.success, link.success.default
  green400: tokens.color.graphics.success.muted.dark, // graphics.success, border.success
  green300: color.green.dark.transparent[300],
  green200: color.green.dark.transparent[200],
  green100: color.green.dark.transparent[100],

  // Currently used for avatars, badges, booleans, buttons, checkboxes, radio buttons
  chonk: {
    blue400: color.categorical.dark.blurple,
    pink400: color.pink.dark.opaque[400],
    red400: color.red.dark.opaque[900],
    yellow400: color.yellow.dark.opaque[1200],
    green400: color.green.dark.opaque[1100],
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

const generateAliases = (
  deprecatedTokens: ReturnType<typeof generateDeprecatedChonkTokens>,
  colors: typeof lightColors
) => ({
  /**
   * Heading text color
   */
  headingColor: deprecatedTokens.content.primary,

  /**
   * Primary text color
   */
  textColor: deprecatedTokens.content.primary,

  /**
   * Text that should not have as much emphasis
   */
  subText: deprecatedTokens.content.muted,

  /**
   * Background for the main content area of a page?
   */
  bodyBackground: deprecatedTokens.background.secondary,

  /**
   * Primary background color
   */
  background: deprecatedTokens.background.primary,

  /**
   * Elevated background color
   */
  backgroundElevated: deprecatedTokens.background.primary,

  /**
   * Secondary background color used as a slight contrast against primary background
   */
  backgroundSecondary: deprecatedTokens.background.secondary,

  /**
   * Tertiary background color used as a stronger contrast against primary background
   */
  backgroundTertiary: deprecatedTokens.background.tertiary,

  /**
   * Background for the header of a page
   */
  headerBackground: deprecatedTokens.background.primary,

  /**
   * Primary border color
   */
  border: deprecatedTokens.border.primary,
  translucentBorder: deprecatedTokens.border.primary,

  /**
   * Inner borders, e.g. borders inside of a grid
   */
  innerBorder: deprecatedTokens.border.muted,
  translucentInnerBorder: deprecatedTokens.border.muted,

  /**
   * A color that denotes a "success", or something good
   */
  success: deprecatedTokens.content.success,
  successText: deprecatedTokens.content.success,
  // @TODO(jonasbadalic): should this reference a chonk color?
  successFocus: deprecatedTokens.border.success, // Not being used

  /**
   * A color that denotes an error, or something that is wrong
   */
  error: deprecatedTokens.content.danger,
  errorText: deprecatedTokens.content.danger,
  errorFocus: deprecatedTokens.border.danger,

  /**
   * A color that denotes danger, for dangerous actions like deletion
   */
  danger: deprecatedTokens.content.danger,
  dangerText: deprecatedTokens.content.danger,
  // @TODO(jonasbadalic): should this reference a chonk color?
  dangerFocus: deprecatedTokens.border.danger, // Not being used

  /**
   * A color that denotes a warning
   */
  warning: deprecatedTokens.content.warning,
  warningText: deprecatedTokens.content.warning,
  // @TODO(jonasbadalic): should this reference a chonk color?
  warningFocus: deprecatedTokens.border.warning, // Not being used

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
  active: deprecatedTokens.component.link.accent.active,
  activeHover: deprecatedTokens.component.link.accent.hover,
  activeText: deprecatedTokens.component.link.accent.default,

  /**
   * Indicates that something has "focus", which is different than "active" state as it is more temporal
   * and should be a bit subtler than active
   */
  focus: deprecatedTokens.border.accent,
  focusBorder: deprecatedTokens.border.accent,

  /**
   * Link color indicates that something is clickable
   */
  linkColor: deprecatedTokens.component.link.accent.default,
  linkHoverColor: deprecatedTokens.component.link.accent.hover,
  linkUnderline: deprecatedTokens.component.link.accent.default,
  linkFocus: deprecatedTokens.border.accent,

  /**
   * Form placeholder text color
   */
  formPlaceholder: colors.gray300,

  /**
   *
   */
  rowBackground: deprecatedTokens.background.primary,

  /**
   * Color of lines that flow across the background of the chart to indicate axes levels
   * (This should only be used for yAxis)
   */
  chartLineColor: colors.gray300,

  /**
   * Color for chart label text
   */
  chartLabel: deprecatedTokens.content.muted,

  /**
   * Color for the 'others' series in topEvent charts
   */
  chartOther: deprecatedTokens.content.muted,

  /**
   * Hover color of the drag handle used in the content slider diff view.
   */
  diffSliderDragHandleHover: colors.blue500,

  /**
   * Default Progressbar color
   */
  progressBar: colors.chonk.blue400,

  /**
   * Default Progressbar color
   */
  progressBackground: colors.gray100,

  // @todo(jonasbadalic) should these reference chonk colors?
  searchTokenBackground: {
    valid: colors.blue100,
    validActive: modifyColor(colors.blue100).opaquer(1.0).string(),
    invalid: colors.red100,
    invalidActive: modifyColor(colors.red100).opaquer(0.8).string(),
    warning: colors.yellow100,
    warningActive: modifyColor(colors.yellow100).opaquer(0.8).string(),
  },

  /**
   * Search filter "token" border
   * NOTE: Not being used anymore in the new Search UI
   */
  searchTokenBorder: {
    valid: colors.blue200,
    validActive: modifyColor(colors.blue200).opaquer(1).string(),
    invalid: colors.red200,
    invalidActive: modifyColor(colors.red200).opaquer(1).string(),
    warning: colors.yellow200,
    warningActive: modifyColor(colors.yellow200).opaquer(1).string(),
  },
});

const fontSize = {
  xs: '11px' as const,
  sm: '12px' as const,
  md: '14px' as const,
  lg: '16px' as const,
  xl: '20px' as const,
  '2xl': '24px' as const,
} satisfies Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl', string>;

const chonkCommonTheme = {
  ...commonTheme,
  fontSize,
};

// Mapping of chonk theme to sentry theme
const chonkLightColorMapping: ColorMapping = {
  black: lightColors.black,
  white: lightColors.white,

  // @TODO(jonasbadalic): why is this needed?
  lightModeBlack: lightColors.black,
  lightModeWhite: lightColors.white,

  surface100: lightColors.surface200,
  surface200: lightColors.surface300,
  surface300: lightColors.surface400,
  surface400: lightColors.surface500,

  translucentSurface100: lightColors.surface100,
  translucentSurface200: lightColors.surface200,

  surface500: lightColors.surface500,

  gray500: lightColors.gray800,
  gray400: lightColors.gray500,
  gray300: lightColors.gray400,
  gray200: lightColors.gray200,
  gray100: lightColors.gray100,

  translucentGray200: lightColors.gray200,
  translucentGray100: lightColors.gray100,

  purple400: lightColors.blue500,
  purple300: lightColors.blue400,
  purple200: lightColors.blue200,
  purple100: lightColors.blue100,

  blue400: lightColors.blue500,
  blue300: lightColors.blue400,
  blue200: lightColors.blue200,
  blue100: lightColors.blue100,

  pink400: lightColors.pink500,
  pink300: lightColors.pink400,
  pink200: lightColors.pink200,
  pink100: lightColors.pink100,

  red400: lightColors.red500,
  red300: lightColors.red400,
  red200: lightColors.red200,
  red100: lightColors.red100,

  yellow400: lightColors.yellow500,
  yellow300: lightColors.yellow400,
  yellow200: lightColors.yellow200,
  yellow100: lightColors.yellow100,

  green400: lightColors.green500,
  green300: lightColors.green400,
  green200: lightColors.green200,
  green100: lightColors.green100,
};

const chonkDarkColorMapping: ColorMapping = {
  black: darkColors.black,
  white: darkColors.white,

  lightModeBlack: darkColors.black,
  lightModeWhite: darkColors.white,

  surface100: darkColors.surface200,
  surface200: darkColors.surface300,
  surface300: darkColors.surface400,
  surface400: darkColors.surface500,
  surface500: darkColors.surface500,

  translucentSurface100: darkColors.surface100,
  translucentSurface200: darkColors.surface200,

  gray500: darkColors.gray500,
  gray400: darkColors.gray400,
  gray300: darkColors.gray300,
  gray200: darkColors.gray200,
  gray100: darkColors.gray100,

  translucentGray200: darkColors.gray200,
  translucentGray100: darkColors.gray100,

  purple400: darkColors.blue500,
  purple300: darkColors.blue400,
  purple200: darkColors.blue200,
  purple100: darkColors.blue100,

  blue400: darkColors.blue500,
  blue300: darkColors.blue400,
  blue200: darkColors.blue200,
  blue100: darkColors.blue100,

  pink400: darkColors.pink500,
  pink300: darkColors.pink400,
  pink200: darkColors.pink200,
  pink100: darkColors.pink100,

  green400: darkColors.green500,
  green300: darkColors.green400,
  green200: darkColors.green200,
  green100: darkColors.green100,

  yellow400: darkColors.yellow500,
  yellow300: darkColors.yellow400,
  yellow200: darkColors.yellow200,
  yellow100: darkColors.yellow100,

  red400: darkColors.red500,
  red300: darkColors.red400,
  red200: darkColors.red200,
  red100: darkColors.red100,
};

const lightTokens = generateDeprecatedChonkTokens(lightColors);
const darkTokens = generateDeprecatedChonkTokens(darkColors);

const lightAliases = generateAliases(lightTokens, lightColors);
const darkAliases = generateAliases(
  generateDeprecatedChonkTokens(darkColors),
  darkColors
);

interface ChonkTheme extends Omit<SentryTheme, 'isChonk' | 'chart'> {
  chart: {
    colors: typeof CHART_PALETTE_LIGHT | typeof CHART_PALETTE_DARK;
    getColorPalette: ReturnType<typeof makeChartColorPalette>;
    neutral: string;
  };
  colors: typeof lightColors & {
    background: ReturnType<typeof generateDeprecatedChonkTokens>['background'];
    border: ReturnType<typeof generateDeprecatedChonkTokens>['border'];
    content: ReturnType<typeof generateDeprecatedChonkTokens>['content'];
  };
  focusRing: (existingShadow?: React.CSSProperties['boxShadow']) => {
    boxShadow: React.CSSProperties['boxShadow'];
    outline: React.CSSProperties['outline'];
  };
  isChonk: true;
  radius: typeof radius;
  tokens: typeof lightTokens;
}

/**
 * @deprecated use useTheme hook instead of directly importing the theme. If you require a theme for your tests, use ThemeFixture.
 */
export const DO_NOT_USE_lightChonkTheme: ChonkTheme = {
  isChonk: true,
  type: 'light',
  // @TODO: color theme contains some colors (like chart color palette, diff, tag and level)
  ...chonkCommonTheme,
  ...formTheme,
  ...chonkLightColorMapping,
  ...lightAliases,
  ...lightShadows,

  tokens: lightTokens,

  inverted: {
    ...chonkDarkColorMapping,
    ...darkAliases,
    tokens: darkTokens,
  },
  radius,
  focusRing: (baseShadow = `0 0 0 0 ${lightAliases.background}`) => ({
    outline: 'none',
    boxShadow: `${baseShadow}, 0 0 0 2px ${lightAliases.focusBorder}`,
  }),

  // @TODO: these colors need to be ported
  ...generateThemeUtils(chonkLightColorMapping, lightAliases),
  alert: generateAlertTheme(chonkLightColorMapping, lightAliases),
  button: generateButtonTheme(chonkLightColorMapping, lightAliases),
  tag: generateTagTheme(chonkLightColorMapping),
  level: generateLevelTheme(chonkLightColorMapping),

  chart: {
    neutral: modifyColor(lightColors.gray400).lighten(0.8).toString(),
    colors: CHART_PALETTE_LIGHT,
    getColorPalette: makeChartColorPalette(CHART_PALETTE_LIGHT),
  },

  prismVariables: generateThemePrismVariables(
    prismLight,
    lightAliases.backgroundSecondary
  ),
  prismDarkVariables: generateThemePrismVariables(
    prismDark,
    darkAliases.backgroundElevated
  ),

  stacktraceActiveBackground: lightTheme.stacktraceActiveBackground,
  stacktraceActiveText: lightTheme.stacktraceActiveText,

  colors: {
    ...lightColors,
    content: generateDeprecatedChonkTokens(lightColors).content,
    background: generateDeprecatedChonkTokens(lightColors).background,
    border: generateDeprecatedChonkTokens(lightColors).border,
  },

  sidebar: {
    background: lightAliases.background,
    scrollbarThumbColor: '#A0A0A0',
    scrollbarColorTrack: 'rgba(45,26,50,92.42)', // end of the gradient which is used for background
    gradient: lightAliases.background,
    border: lightAliases.border,
    superuser: '#880808',
  },
};

/**
 * @deprecated use useTheme hook instead of directly importing the theme. If you require a theme for your tests, use ThemeFixture.
 */
export const DO_NOT_USE_darkChonkTheme: ChonkTheme = {
  isChonk: true,
  type: 'dark',
  // @TODO: color theme contains some colors (like chart color palette, diff, tag and level)
  ...chonkCommonTheme,
  ...formTheme,
  ...chonkDarkColorMapping,
  ...darkAliases,
  ...darkShadows,
  tokens: darkTokens,

  inverted: {
    ...chonkDarkColorMapping,
    ...darkAliases,
    tokens: lightTokens,
  },

  radius,
  focusRing: (baseShadow = `0 0 0 0 ${darkAliases.background}`) => ({
    outline: 'none',
    boxShadow: `${baseShadow}, 0 0 0 2px ${darkAliases.focusBorder}`,
  }),

  // @TODO: these colors need to be ported
  ...generateThemeUtils(chonkDarkColorMapping, darkAliases),
  alert: generateAlertTheme(chonkDarkColorMapping, darkAliases),
  button: generateButtonTheme(chonkDarkColorMapping, darkAliases),
  tag: generateTagTheme(chonkDarkColorMapping),
  level: generateLevelTheme(chonkDarkColorMapping),

  chart: {
    neutral: modifyColor(darkColors.gray400).darken(0.35).toString(),
    colors: CHART_PALETTE_DARK,
    getColorPalette: makeChartColorPalette(CHART_PALETTE_DARK),
  },

  prismVariables: generateThemePrismVariables(prismDark, darkAliases.backgroundSecondary),
  prismDarkVariables: generateThemePrismVariables(
    prismDark,
    darkAliases.backgroundElevated
  ),

  stacktraceActiveBackground: darkTheme.stacktraceActiveBackground,
  stacktraceActiveText: darkTheme.stacktraceActiveText,

  colors: {
    ...darkColors,
    content: generateDeprecatedChonkTokens(darkColors).content,
    background: generateDeprecatedChonkTokens(darkColors).background,
    border: generateDeprecatedChonkTokens(darkColors).border,
  },

  sidebar: {
    background: darkAliases.background,
    scrollbarThumbColor: '#A0A0A0',
    scrollbarColorTrack: 'rgba(45,26,50,92.42)', // end of the gradient which is used for background
    gradient: darkAliases.background,
    border: darkAliases.border,
    superuser: '#880808',
  },
};

declare module '@emotion/react' {
  // @TODO(jonasbadalic): interface extending a type might be prone to some issues.
  // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-shadow
  export interface DO_NOT_USE_ChonkTheme extends ChonkTheme {
    isChonk: true;
  }

  /**
   * Configure Emotion to use our theme
   */
  export interface Theme extends SentryTheme {
    isChonk: boolean;
  }
}

/**
 * Chonk utilities and overrrides to assert correct theme type
 * inside chonk components without having to check for theme.isChonk everywhere
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
interface DO_NOT_USE_ChonkTheme extends ChonkTheme {
  isChonk: true;
}

// Emotion has no override available for styled, so we create our own,
// which allows us to use chonkStyled and access the chonk theme and write
// our components with a future type API.
interface ChonkCreateStyled {
  <
    C extends React.ComponentClass<React.ComponentProps<C>>,
    ForwardedProps extends keyof React.ComponentProps<C> &
      string = keyof React.ComponentProps<C> & string,
  >(
    component: C,
    options: FilteringStyledOptions<React.ComponentProps<C>, ForwardedProps>
  ): CreateStyledComponent<
    Pick<React.ComponentProps<C>, ForwardedProps> & {
      theme?: DO_NOT_USE_ChonkTheme;
    },
    Record<string, unknown>,
    {
      ref?: React.Ref<InstanceType<C>>;
    }
  >;
  <C extends React.ComponentClass<React.ComponentProps<C>>>(
    component: C,
    options?: StyledOptions<React.ComponentProps<C>>
  ): CreateStyledComponent<
    React.ComponentProps<C> & {
      theme?: DO_NOT_USE_ChonkTheme;
    },
    Record<string, unknown>,
    {
      ref?: React.Ref<InstanceType<C>>;
    }
  >;
  <
    C extends React.ComponentType<React.ComponentProps<C>>,
    ForwardedProps extends keyof React.ComponentProps<C> &
      string = keyof React.ComponentProps<C> & string,
  >(
    component: C,
    options: FilteringStyledOptions<React.ComponentProps<C>, ForwardedProps>
  ): CreateStyledComponent<
    Pick<React.ComponentProps<C>, ForwardedProps> & {
      theme?: DO_NOT_USE_ChonkTheme;
    }
  >;
  <C extends React.ComponentType<React.ComponentProps<C>>>(
    component: C,
    options?: StyledOptions<React.ComponentProps<C>>
  ): CreateStyledComponent<
    React.ComponentProps<C> & {
      theme?: DO_NOT_USE_ChonkTheme;
    }
  >;
  <
    Tag extends keyof React.JSX.IntrinsicElements,
    ForwardedProps extends keyof React.JSX.IntrinsicElements[Tag] &
      string = keyof React.JSX.IntrinsicElements[Tag] & string,
  >(
    tag: Tag,
    options: FilteringStyledOptions<React.JSX.IntrinsicElements[Tag], ForwardedProps>
  ): CreateStyledComponent<
    {
      as?: React.ElementType;
      theme?: DO_NOT_USE_ChonkTheme;
    },
    Pick<React.JSX.IntrinsicElements[Tag], ForwardedProps>
  >;
  <Tag extends keyof React.JSX.IntrinsicElements>(
    tag: Tag,
    options?: StyledOptions<React.JSX.IntrinsicElements[Tag]>
  ): CreateStyledComponent<
    {
      as?: React.ElementType;
      theme?: DO_NOT_USE_ChonkTheme;
    },
    React.JSX.IntrinsicElements[Tag]
  >;
}

type ChonkStyled = {
  [Tag in keyof React.JSX.IntrinsicElements]: CreateStyledComponent<
    {
      as?: React.ElementType;
      theme?: DO_NOT_USE_ChonkTheme;
    },
    React.JSX.IntrinsicElements[Tag]
  >;
};

// Emotion has no override available for styled, so we create our own,
// which allows us to use chonkStyled and access the chonk theme and write
// our components with a future type API.
interface ChonkStyle extends ChonkCreateStyled, ChonkStyled {}
export const chonkStyled = styled as ChonkStyle;

export function useChonkTheme(): ChonkTheme {
  const theme = useTheme() as Theme | ChonkTheme;

  assertChonkTheme(theme);
  return theme;
}

function assertChonkTheme(
  theme: Theme | DO_NOT_USE_ChonkTheme
): asserts theme is ChonkTheme {
  if (!theme.isChonk) {
    throw new Error('A chonk component may only be called inside a chonk theme context');
  }
}
