import type React from 'react';
import {type Theme, useTheme} from '@emotion/react';
import styled, {
  type CreateStyledComponent,
  type FilteringStyledOptions,
  type StyledOptions,
} from '@emotion/styled';
import color from 'color';

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
function generateChonkTokens(colorScheme: typeof lightColors) {
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

const space = {
  none: '0px',
  '2xs': '2px',
  xs: '4px',
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  '3xl': '32px',
} as const;

const radius = {
  none: '0px',
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
  black: '#181423',
  white: '#FFFFFF',

  surface500: '#FFFFFF', // background.primary
  surface400: '#F7F6FB', // background.secondary
  surface300: '#F1EEF9', // background.tertiary
  surface200: '#EAE7F6', // border.muted
  surface100: '#DFDBEF', // border.primary

  gray800: '#181423', // content.primary
  gray700: '#3B434E', // ⚠ link.muted.active only
  gray600: '#48515B', // ⚠ link.muted.hover only
  gray500: '#57606B', // content.secondary, link.muted.default
  gray400: '#707C89', // graphics.muted
  gray300: 'rgba(112, 124, 137, 0.12)',
  gray200: 'rgba(112, 124, 137, 0.09)',
  gray100: 'rgba(112, 124, 137, 0.05)',

  blue700: '#4E09BC', // ⚠ link.accent.active only
  blue600: '#5D0CDC', // ⚠ link.accent.hover only
  blue500: '#6C02FF', // content.accent, link.accent.default
  blue400: '#8466FF', // graphics.muted, border.accent
  blue300: 'rgba(132, 102, 255, 0.13)',
  blue200: 'rgba(132, 102, 255, 0.09)',
  blue100: 'rgba(132, 102, 255, 0.05)',

  pink700: '#A11B6C', // ⚠ link.promotion.active only
  pink600: '#B60979', // ⚠ link.promotion.hover only
  pink500: '#D5008D', // content.promotion, link.promotion.default
  pink400: '#FF4EB3', // graphics.promotion, border.promotion
  pink300: 'rgba(255, 78, 179, 0.17)',
  pink200: 'rgba(255, 78, 179, 0.12)',
  pink100: 'rgba(255, 78, 179, 0.06)',

  red700: '#9C0819', // ⚠ link.danger.active only
  red600: '#B1001B', // ⚠ link.danger.hover only
  red500: '#CB0020', // ⚠ content.danger, link.danger.default
  red400: '#FF002B', // graphics.danger, border.danger
  red300: 'rgba(255, 0, 43, 0.10)',
  red200: 'rgba(255, 0, 43, 0.08)',
  red100: 'rgba(255, 0, 43, 0.04)',

  yellow700: '#AD4A0D', // ⚠ link.warning.active only
  yellow600: '#C55200', // ⚠ link.warning.hover only
  yellow500: '#E66000', // content.warning, link.warning.default
  yellow400: '#F3B01B', // graphics.warning, border.warning
  yellow300: 'rgba(243, 176, 27, 0.24)',
  yellow200: 'rgba(243, 176, 27, 0.17)',
  yellow100: 'rgba(243, 176, 27, 0.07)',

  green700: '#01651F', // ⚠ link.success.active only
  green600: '#017526', // ⚠ link.success.hover only
  green500: '#06892F', // content.success, link.success.default
  green400: '#06AC3D', // graphics.success, border.success
  green300: 'rgba(6, 172, 61, 0.10)',
  green200: 'rgba(6, 172, 61, 0.07)',
  green100: 'rgba(6, 172, 61, 0.04)',

  // Currently used for avatars, badges, booleans, buttons, checkboxes, radio buttons
  chonk: {
    blue400: '#7553FF',
    pink400: '#FF70BC',
    red400: '#E50045',
    yellow400: '#FFD00E',
    green400: '#00F261',
  },
};

const darkColors: typeof lightColors = {
  black: '#181423',
  white: '#FFFFFF',

  surface500: '#272433', // background.primary
  surface400: '#231E2F', // background.secondary
  surface300: '#191621', // background.teritary
  surface200: '#0D071A', // border.muted
  surface100: '#000000', // border.primary

  gray800: '#F6F5FA', // content.primary
  gray700: '#C6C0D6', // ⚠ link.muted.active only
  gray600: '#B3ADC3', // ⚠ link.muted.hover only
  gray500: '#A39EB3', // content.secondary, link.muted.default
  gray400: '#6F6F78', // // graphics.muted
  gray300: 'rgba(110, 110, 119, 0.38)',
  gray200: 'rgba(110, 110, 119, 0.28)',
  gray100: 'rgba(110, 110, 119, 0.20)',

  blue700: '#BBB6FC', // ⚠ link.accent.active only
  blue600: '#A89EFC', // ⚠ link.accent.hover only
  blue500: '#9B8DFF', // content.accent, link.accent.default
  blue400: '#8970FF', // // graphics.accent, border.accent
  blue300: 'rgba(137, 112, 255, 0.26)',
  blue200: 'rgba(137, 112, 255, 0.20)',
  blue100: 'rgba(137, 112, 255, 0.14)',

  pink700: '#FFC4DF', // ⚠ link.promotion.active only
  pink600: '#FFA3CF', // ⚠ link.promotion.hover only
  pink500: '#FF8BC6', // content.promotion, link.promotion.default
  pink400: '#FF5CB6', // // graphics.promotion, border.promotion
  pink300: 'rgba(255, 92, 182, 0.20)',
  pink200: 'rgba(255, 92, 182, 0.15)',
  pink100: 'rgba(255, 92, 182, 0.11)',

  red700: '#FFB0A8', // ⚠ link.danger.active only
  red600: '#FF8A82', // ⚠ link.danger.hover only
  red500: '#FF6B65', // content.danger, link.danger.default
  red400: '#FF333C', // // graphics.danger, border.danger
  red300: 'rgba(255, 51, 60, 0.26)',
  red200: 'rgba(255, 51, 60, 0.20)',
  red100: 'rgba(255, 51, 60, 0.16)',

  yellow700: '#FCEBB7', // ⚠ link.warning.active only
  yellow600: '#F8DC86', // ⚠ link.warning.hover only
  yellow500: '#FDCF20', // content.warning, link.warning.default
  yellow400: '#F7B31C', // graphics.warning, border.warning
  yellow300: 'rgba(247, 179, 28, 0.17)',
  yellow200: 'rgba(247, 179, 28, 0.13)',
  yellow100: 'rgba(247, 179, 28, 0.09)',

  green700: '#4AE969', // ⚠ link.success.active only
  green600: '#32D859', // ⚠ link.success.hover only
  green500: '#0CC848', // content.success, link.success.default
  green400: '#09B340', // graphics.success, border.success
  green300: 'rgba(9, 179, 64, 0.33)',
  green200: 'rgba(9, 179, 64, 0.26)',
  green100: 'rgba(9, 179, 64, 0.20)',

  // Currently used for avatars, badges, booleans, buttons, checkboxes, radio buttons
  chonk: {
    blue400: '#7553FF',
    pink400: '#FF70BC',
    red400: '#E50045',
    yellow400: '#FFD00E',
    green400: '#00F261',
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
  tokens: ReturnType<typeof generateChonkTokens>,
  colors: typeof lightColors
) => ({
  /**
   * Heading text color
   */
  headingColor: tokens.content.primary,

  /**
   * Primary text color
   */
  textColor: tokens.content.primary,

  /**
   * Text that should not have as much emphasis
   */
  subText: tokens.content.muted,

  /**
   * Background for the main content area of a page?
   */
  bodyBackground: tokens.background.secondary,

  /**
   * Primary background color
   */
  background: tokens.background.primary,

  /**
   * Elevated background color
   */
  backgroundElevated: tokens.background.primary,

  /**
   * Secondary background color used as a slight contrast against primary background
   */
  backgroundSecondary: tokens.background.secondary,

  /**
   * Tertiary background color used as a stronger contrast against primary background
   */
  backgroundTertiary: tokens.background.tertiary,

  /**
   * Background for the header of a page
   */
  headerBackground: tokens.background.primary,

  /**
   * Primary border color
   */
  border: tokens.border.primary,
  translucentBorder: tokens.border.primary,

  /**
   * Inner borders, e.g. borders inside of a grid
   */
  innerBorder: tokens.border.muted,
  translucentInnerBorder: tokens.border.muted,

  /**
   * A color that denotes a "success", or something good
   */
  success: tokens.content.success,
  successText: tokens.content.success,
  // @TODO(jonasbadalic): should this reference a chonk color?
  successFocus: tokens.border.success, // Not being used

  /**
   * A color that denotes an error, or something that is wrong
   */
  error: tokens.content.danger,
  errorText: tokens.content.danger,
  errorFocus: tokens.border.danger,

  /**
   * A color that denotes danger, for dangerous actions like deletion
   */
  danger: tokens.content.danger,
  dangerText: tokens.content.danger,
  // @TODO(jonasbadalic): should this reference a chonk color?
  dangerFocus: tokens.border.danger, // Not being used

  /**
   * A color that denotes a warning
   */
  warning: tokens.content.warning,
  warningText: tokens.content.warning,
  // @TODO(jonasbadalic): should this reference a chonk color?
  warningFocus: tokens.border.warning, // Not being used

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
  active: tokens.component.link.accent.active,
  activeHover: tokens.component.link.accent.hover,
  activeText: tokens.component.link.accent.default,

  /**
   * Indicates that something has "focus", which is different than "active" state as it is more temporal
   * and should be a bit subtler than active
   */
  focus: tokens.border.accent,
  focusBorder: tokens.border.accent,

  /**
   * Link color indicates that something is clickable
   */
  linkColor: tokens.component.link.accent.default,
  linkHoverColor: tokens.component.link.accent.hover,
  linkUnderline: tokens.component.link.accent.default,
  linkFocus: tokens.border.accent,

  /**
   * Form placeholder text color
   */
  formPlaceholder: colors.gray300,

  /**
   *
   */
  rowBackground: tokens.background.primary,

  /**
   * Color of lines that flow across the background of the chart to indicate axes levels
   * (This should only be used for yAxis)
   */
  chartLineColor: colors.gray300,

  /**
   * Color for chart label text
   */
  chartLabel: tokens.content.muted,

  /**
   * Color for the 'others' series in topEvent charts
   */
  chartOther: tokens.content.muted,

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
    validActive: color(colors.blue100).opaquer(1.0).string(),
    invalid: colors.red100,
    invalidActive: color(colors.red100).opaquer(0.8).string(),
    warning: colors.yellow100,
    warningActive: color(colors.yellow100).opaquer(0.8).string(),
  },

  /**
   * Search filter "token" border
   * NOTE: Not being used anymore in the new Search UI
   */
  searchTokenBorder: {
    valid: colors.blue200,
    validActive: color(colors.blue200).opaquer(1).string(),
    invalid: colors.red200,
    invalidActive: color(colors.red200).opaquer(1).string(),
    warning: colors.yellow200,
    warningActive: color(colors.yellow200).opaquer(1).string(),
  },

  /**
   * Background of alert banners at the top
   */
  bannerBackground: colors.gray500,
});

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

const lightTokens = generateChonkTokens(lightColors);
const darkTokens = generateChonkTokens(darkColors);

const lightAliases = generateAliases(lightTokens, lightColors);
const darkAliases = generateAliases(generateChonkTokens(darkColors), darkColors);

interface ChonkTheme extends Omit<SentryTheme, 'isChonk' | 'chart'> {
  chart: {
    colors: typeof CHART_PALETTE_LIGHT | typeof CHART_PALETTE_DARK;
    getColorPalette: ReturnType<typeof makeChartColorPalette>;
    neutral: string;
  };
  colors: typeof lightColors & {
    background: ReturnType<typeof generateChonkTokens>['background'];
    border: ReturnType<typeof generateChonkTokens>['border'];
    content: ReturnType<typeof generateChonkTokens>['content'];
  };
  focusRing: {
    boxShadow: React.CSSProperties['boxShadow'];
    outline: React.CSSProperties['outline'];
  };
  isChonk: true;
  radius: typeof radius;

  space: typeof space;
  tokens: typeof lightTokens;
}

/**
 * @deprecated use useTheme hook instead of directly importing the theme. If you require a theme for your tests, use ThemeFixture.
 */
export const DO_NOT_USE_lightChonkTheme: ChonkTheme = {
  isChonk: true,
  type: 'light',
  // @TODO: color theme contains some colors (like chart color palette, diff, tag and level)
  ...commonTheme,
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

  space,
  radius,
  focusRing: {
    outline: 'none',
    boxShadow: `0 0 0 0 ${lightAliases.background}, 0 0 0 2px ${lightAliases.focusBorder}`,
  },

  // @TODO: these colors need to be ported
  ...generateThemeUtils(chonkLightColorMapping, lightAliases),
  alert: generateAlertTheme(chonkLightColorMapping, lightAliases),
  button: generateButtonTheme(chonkLightColorMapping, lightAliases),
  tag: generateTagTheme(chonkLightColorMapping),
  level: generateLevelTheme(chonkLightColorMapping),

  tour: {
    background: darkColors.surface400,
    header: darkColors.white,
    text: darkAliases.subText,
    next: lightAliases.textColor,
    previous: darkColors.white,
    close: lightColors.white,
  },

  chart: {
    neutral: color(lightColors.gray400).lighten(0.8).toString(),
    colors: CHART_PALETTE_LIGHT,
    getColorPalette: makeChartColorPalette(CHART_PALETTE_LIGHT),
  },

  prismVariables: generateThemePrismVariables(
    prismLight,
    lightAliases.backgroundTertiary
  ),
  prismDarkVariables: generateThemePrismVariables(
    prismDark,
    darkAliases.backgroundElevated
  ),

  stacktraceActiveBackground: lightTheme.stacktraceActiveBackground,
  stacktraceActiveText: lightTheme.stacktraceActiveText,

  colors: {
    ...lightColors,
    content: generateChonkTokens(lightColors).content,
    background: generateChonkTokens(lightColors).background,
    border: generateChonkTokens(lightColors).border,
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
  ...commonTheme,
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

  space,
  radius,
  focusRing: {
    outline: 'none',
    boxShadow: `0 0 0 0 ${darkAliases.background}, 0 0 0 2px ${darkAliases.focusBorder}`,
  },

  // @TODO: these colors need to be ported
  ...generateThemeUtils(chonkDarkColorMapping, darkAliases),
  alert: generateAlertTheme(chonkDarkColorMapping, darkAliases),
  button: generateButtonTheme(chonkDarkColorMapping, darkAliases),
  tag: generateTagTheme(chonkDarkColorMapping),
  level: generateLevelTheme(chonkDarkColorMapping),

  tour: {
    background: darkColors.blue400,
    header: darkColors.white,
    text: darkColors.white,
    next: lightAliases.textColor,
    previous: darkColors.white,
    close: lightColors.white,
  },

  chart: {
    neutral: color(darkColors.gray400).darken(0.35).toString(),
    colors: CHART_PALETTE_DARK,
    getColorPalette: makeChartColorPalette(CHART_PALETTE_DARK),
  },

  prismVariables: generateThemePrismVariables(prismDark, darkAliases.backgroundTertiary),
  prismDarkVariables: generateThemePrismVariables(
    prismDark,
    darkAliases.backgroundTertiary
  ),

  stacktraceActiveBackground: darkTheme.stacktraceActiveBackground,
  stacktraceActiveText: darkTheme.stacktraceActiveText,

  colors: {
    ...darkColors,
    content: generateChonkTokens(darkColors).content,
    background: generateChonkTokens(darkColors).background,
    border: generateChonkTokens(darkColors).border,
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
