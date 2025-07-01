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
  ['#7553FF', '#FFD00E'],
  ['#7553FF', '#F53A9F', '#FFD00E'],
  ['#7553FF', '#F53A9F', '#FFD00E', '#67C800'],
  ['#7553FF', '#F53A9F', '#FFD00E', '#67C800', '#00A9D2'],
  ['#7553FF', '#F53A9F', '#FF9838', '#FFD00E', '#67C800', '#00A9D2'],
  ['#7553FF', '#5533B2', '#F53A9F', '#FF9838', '#FFD00E', '#67C800', '#00A9D2'],
  [
    '#7553FF',
    '#5533B2',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#67C800',
    '#00A9D2',
  ],
  [
    '#7553FF',
    '#5533B2',
    '#9E2C8D',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#67C800',
    '#00A9D2',
  ],
  [
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#9E2C8D',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#67C800',
    '#00A9D2',
  ],
  [
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#9E2C8D',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#00A9D2',
  ],
  [
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#9E2C8D',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#00A9D2',
    '#7553FF',
  ],
  [
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#9E2C8D',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#00A9D2',
    '#7553FF',
    '#5533B2',
  ],
  [
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#9E2C8D',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#00A9D2',
    '#7553FF',
    '#5533B2',
    '#3A1873',
  ],
  [
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#9E2C8D',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#00A9D2',
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#9E2C8D',
  ],
  [
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#9E2C8D',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#00A9D2',
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#9E2C8D',
    '#F53A9F',
  ],
  [
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#9E2C8D',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#00A9D2',
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#9E2C8D',
    '#F53A9F',
    '#FC746F',
  ],
  [
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#9E2C8D',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#00A9D2',
    '#7553FF',
    '#5533B2',
    '#3A1873',
    '#9E2C8D',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
  ],
] as const;

const CHART_PALETTE_DARK = [
  ['#7A60FB'],
  ['#7A60FB', '#FFD00E'],
  ['#7A60FB', '#F53A9F', '#FFD00E'],
  ['#7A60FB', '#F53A9F', '#FFD00E', '#67C800'],
  ['#7A60FB', '#F53A9F', '#FFD00E', '#67C800', '#0CACD4'],
  ['#7A60FB', '#F53A9F', '#FF9838', '#FFD00E', '#67C800', '#0CACD4'],
  ['#7A60FB', '#5C3CBB', '#F53A9F', '#FF9838', '#FFD00E', '#67C800', '#0CACD4'],
  [
    '#7A60FB',
    '#5C3CBB',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#67C800',
    '#0CACD4',
  ],
  [
    '#7A60FB',
    '#5C3CBB',
    '#B0009C',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#67C800',
    '#0CACD4',
  ],
  [
    '#7A60FB',
    '#5C3CBB',
    '#50219C',
    '#B0009C',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#67C800',
    '#0CACD4',
  ],
  [
    '#7A60FB',
    '#5C3CBB',
    '#50219C',
    '#B0009C',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#0CACD4',
  ],
  [
    '#7A60FB',
    '#5C3CBB',
    '#50219C',
    '#B0009C',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#0CACD4',
    '#7A60FB',
  ],
  [
    '#7A60FB',
    '#5C3CBB',
    '#50219C',
    '#B0009C',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#0CACD4',
    '#7A60FB',
    '#5C3CBB',
  ],
  [
    '#7A60FB',
    '#5C3CBB',
    '#50219C',
    '#B0009C',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#0CACD4',
    '#7A60FB',
    '#5C3CBB',
    '#50219C',
  ],
  [
    '#7A60FB',
    '#5C3CBB',
    '#50219C',
    '#B0009C',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#0CACD4',
    '#7A60FB',
    '#5C3CBB',
    '#50219C',
    '#B0009C',
  ],
  [
    '#7A60FB',
    '#5C3CBB',
    '#50219C',
    '#B0009C',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#0CACD4',
    '#7A60FB',
    '#5C3CBB',
    '#50219C',
    '#B0009C',
    '#F53A9F',
  ],
  [
    '#7A60FB',
    '#5C3CBB',
    '#50219C',
    '#B0009C',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#0CACD4',
    '#7A60FB',
    '#5C3CBB',
    '#50219C',
    '#B0009C',
    '#F53A9F',
    '#FC746F',
  ],
  [
    '#7A60FB',
    '#5C3CBB',
    '#50219C',
    '#B0009C',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
    '#FFD00E',
    '#BACE05',
    '#67C800',
    '#0CACD4',
    '#7A60FB',
    '#5C3CBB',
    '#50219C',
    '#B0009C',
    '#F53A9F',
    '#FC746F',
    '#FF9838',
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
  white: '#F6F5FA',

  surface500: '#FFFFFF', // background.primary
  surface400: '#F4F4FB', // background.secondary
  surface300: '#ECECF8', // background.tertiary
  surface200: '#EBE9F2', // border.muted
  surface100: '#DAD7E5', // border.primary

  // ⚠ Deprecated
  grayOpaque500: '#181423',
  grayOpaque400: '#6D6B74',
  grayOpaque300: '#939198',
  grayOpaque200: '#E0DFE2',
  grayOpaque100: '#F3F3F4',

  // ⚠ Deprecated
  grayTransparent500: 'rgba(24, 20, 35, 1.0)',
  grayTransparent400: 'rgba(24, 20, 35, 0.63)',
  grayTransparent300: 'rgba(24, 20, 35, 0.47)',
  grayTransparent200: 'rgba(24, 20, 35, 0.14)',
  grayTransparent100: 'rgba(24, 20, 35, 0.05)',

  gray800: '#181423', // content.primary
  gray700: '#524E5E', // ⚠ link.muted.active only
  gray600: '#5B5866', // ⚠ link.muted.hover only
  gray500: '#69676F', // content.secondary, link.muted.default
  gray400: '#87858E', // Graphical Objects and User Interface Components
  gray300: 'rgba(24, 20, 35, 0.07)',
  gray200: 'rgba(24, 20, 35, 0.05)',
  gray100: 'rgba(24, 20, 35, 0.03)',

  blue700: '#522FE0', // ⚠ link.accent.active only
  blue600: '#5A38E8', // ⚠ link.accent.hover only
  blue500: '#6341F0', // content.accent, link.accent.default
  blue400: '#8466FF', // Graphical Objects and User Interface Components
  blue300: 'rgba(117, 83, 255, 0.11)',
  blue200: 'rgba(117, 83, 255, 0.08)',
  blue100: 'rgba(117, 83, 255, 0.05)',

  pink700: '#B81A6E', // ⚠ link.promotion.active only
  pink600: '#BF2175', // ⚠ link.promotion.hover only
  pink500: '#C8287D', // content.promotion, link.promotion.default
  pink400: '#F23A9C', // Graphical Objects and User Interface Components
  pink300: 'rgba(255, 69, 168, 0.13)',
  pink200: 'rgba(255, 69, 168, 0.10)',
  pink100: 'rgba(255, 69, 168, 0.07)',

  red700: '#BA0032', // ⚠ link.danger.active only
  red600: '#C20034', // ⚠ link.danger.hover only
  red500: '#C90036', // ⚠ content.danger, link.danger.default
  red400: '#F71954', // Graphical Objects and User Interface Components
  red300: 'rgba(255, 0, 68, 0.09)',
  red200: 'rgba(255, 0, 68, 0.07)',
  red100: 'rgba(255, 0, 68, 0.05)',

  yellow700: '#9C5200', // ⚠ link.warning.active only
  yellow600: '#A35600', // ⚠ link.warning.hover only
  yellow500: '#AC5803', // content.warning, link.warning.default
  yellow400: '#D47515', // Graphical Objects and User Interface Components
  yellow300: 'rgba(253, 208, 27, 0.28)',
  yellow200: 'rgba(253, 208, 27, 0.20)',
  yellow100: 'rgba(253, 208, 27, 0.12)',

  green700: '#0F6E42', // ⚠ link.success.active only
  green600: '#147548', // ⚠ link.success.hover only
  green500: '#197D4F', // content.success, link.success.default
  green400: '#2F9E6C', // Graphical Objects and User Interface Components
  green300: 'rgba(11, 229, 99, 0.18)',
  green200: 'rgba(11, 229, 99, 0.13)',
  green100: 'rgba(11, 229, 99, 0.18)',

  // Currently used for avatars, badges, booleans, buttons, checkboxes, radio buttons
  chonk: {
    blue400: '#7553FF',
    blue300: '#6C4DEB',
    blue200: '#6246D4',
    blue100: '#553DB8',

    pink400: '#FF70BC',
    pink300: '#ED69AF',
    pink200: '#DB61A2',
    pink100: '#962963',

    red400: '#E50045',
    red300: '#D4003F',
    red200: '#C2003B',
    red100: '#A80033',

    yellow400: '#FFD00E',
    yellow300: '#F0C40D',
    yellow200: '#E0B70C',
    yellow100: '#C9A30A',

    green400: '#00F261',
    green300: '#00E35B',
    green200: '#00D455',
    green100: '#00BF4D',
  },
};

const darkColors: typeof lightColors = {
  black: '#181423',
  white: '#F6F5FA',

  surface500: '#272433', // background.primary
  surface400: '#23202E', // background.secondary
  surface300: '#1F1D29', // background.teritary
  surface200: '#18151F', // border.muted
  surface100: '#000000', // border.primary

  // ⚠ Deprecated
  grayOpaque500: '#F6F5FA',
  grayOpaque400: '#A09DA8',
  grayOpaque300: '#767380',
  grayOpaque200: '#4D4A59',
  grayOpaque100: '#3D394A',

  // ⚠ Deprecated
  grayTransparent500: 'rgba(246, 245, 250, 1.0)',
  grayTransparent400: 'rgba(246, 245, 250, 0.58)',
  grayTransparent300: 'rgba(246, 245, 250, 0.37)',
  grayTransparent200: 'rgba(246, 245, 250, 0.18)',
  grayTransparent100: 'rgba(246, 245, 250, 0.10)',

  gray800: '#F6F5FA', // content.primary
  gray700: '#BBB9C4', // ⚠ link.muted.active only
  gray600: '#AFACBD', // ⚠ link.muted.hover only
  gray500: '#A49FB5', // content.secondary, link.muted.default
  gray400: '#837D99', // Graphical Objects and User Interface Components
  gray300: 'rgba(246, 245, 250, 0.12)',
  gray200: 'rgba(246, 245, 250, 0.09)',
  gray100: 'rgba(246, 245, 250, 0.06)',

  blue700: '#C0B0FF', // ⚠ link.accent.active only
  blue600: '#B9A8FF', // ⚠ link.accent.hover only
  blue500: '#B3A1FF', // content.accent, link.accent.default
  blue400: '#9179F2', // Graphical Objects and User Interface Components
  blue300: 'rgba(117, 83, 255, 0.30)',
  blue200: 'rgba(117, 83, 255, 0.24)',
  blue100: 'rgba(117, 83, 255, 0.18)',

  pink700: '#F5ABD3', // ⚠ link.promotion.active only
  pink600: '#F5A4CF', // ⚠ link.promotion.hover only
  pink500: '#F59DCC', // content.promotion, link.promotion.default
  pink400: '#DB7FB0', // Graphical Objects and User Interface Components
  pink300: 'rgba(255, 69, 168, 0.24)',
  pink200: 'rgba(255, 69, 168, 0.18)',
  pink100: 'rgba(255, 69, 168, 0.12)',

  red700: '#FF94A2', // ⚠ link.danger.active only
  red600: '#FF8C9B', // ⚠ link.danger.hover only
  red500: '#FF8595', // content.danger, link.danger.default
  red400: '#D65E6E', // Graphical Objects and User Interface Components
  red300: 'rgba(229, 0, 69, 0.30)',
  red200: 'rgba(229, 0, 69, 0.25)',
  red100: 'rgba(229, 0, 69, 0.20)',

  yellow700: '#FFE375', // ⚠ link.warning.active only
  yellow600: '#FFE26E', // ⚠ link.warning.hover only
  yellow500: '#FFE166', // content.warning, link.warning.default
  yellow400: '#CCB141', // Graphical Objects and User Interface Components
  yellow300: 'rgba(253, 185, 27, 0.17)',
  yellow200: 'rgba(253, 185, 27, 0.14)',
  yellow100: 'rgba(253, 185, 27, 0.10)',

  green700: '#60EB98', // ⚠ link.success.active only
  green600: '#56E38F', // ⚠ link.success.hover only
  green500: '#4DDB86', // content.success, link.success.default
  green400: '#2DAD61', // Graphical Objects and User Interface Components
  green300: 'rgba(11, 229, 99, 0.18)',
  green200: 'rgba(11, 229, 99, 0.14)',
  green100: 'rgba(11, 229, 99, 0.10)',

  // Currently used for avatars, badges, booleans, buttons, checkboxes, radio buttons
  chonk: {
    blue400: '#7553FF',
    blue300: '#6C4DEB',
    blue200: '#6246D4',
    blue100: '#07050F',

    pink400: '#FF70BC',
    pink300: '#ED69AF',
    pink200: '#DB61A2',
    pink100: '#0D0609',

    red400: '#E50045',
    red300: '#D4003F',
    red200: '#C2003B',
    red100: '#1A0007',

    yellow400: '#FFD00E',
    yellow300: '#F0C40D',
    yellow200: '#E0B70C',
    yellow100: '#0A0800',

    green400: '#00F261',
    green300: '#00E35B',
    green200: '#00D455',
    green100: '#000A04',
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
  active: colors.chonk.blue200,
  activeHover: colors.chonk.blue300,
  activeText: tokens.content.accent,

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

  /**
   * Tag progress bars
   */
  tagBarHover: colors.chonk.blue300,
  tagBar: colors.gray200,

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
