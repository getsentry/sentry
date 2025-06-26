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
import color from 'color';

// palette generated via: https://gka.github.io/palettes/#colors=444674,69519A,E1567C,FB7D46,F2B712|steps=20|bez=1|coL=1
const CHART_PALETTE = [
  ['#444674'],
  ['#444674', '#f2b712'],
  ['#444674', '#d6567f', '#f2b712'],
  ['#444674', '#a35488', '#ef7061', '#f2b712'],
  ['#444674', '#895289', '#d6567f', '#f38150', '#f2b712'],
  ['#444674', '#7a5088', '#b85586', '#e9626e', '#f58c46', '#f2b712'],
  ['#444674', '#704f87', '#a35488', '#d6567f', '#ef7061', '#f59340', '#f2b712'],
  [
    '#444674',
    '#694e86',
    '#955389',
    '#c15584',
    '#e65d73',
    '#f27a58',
    '#f6983b',
    '#f2b712',
  ],
  [
    '#444674',
    '#644d85',
    '#895289',
    '#b05587',
    '#d6567f',
    '#ec6868',
    '#f38150',
    '#f69b38',
    '#f2b712',
  ],
  [
    '#444674',
    '#614c84',
    '#815189',
    '#a35488',
    '#c65683',
    '#e35a78',
    '#ef7061',
    '#f4884b',
    '#f59f34',
    '#f2b712',
  ],
  [
    '#444674',
    '#5c4c82',
    '#7a5088',
    '#9a5389',
    '#b85586',
    '#d7567f',
    '#e9626e',
    '#f1785a',
    '#f58c46',
    '#f5a132',
    '#f2b712',
  ],
  [
    '#444674',
    '#5b4b82',
    '#764f88',
    '#925289',
    '#ae5487',
    '#c85682',
    '#e2587a',
    '#ec6b66',
    '#f37d54',
    '#f59143',
    '#f5a42f',
    '#f2b712',
  ],
  [
    '#444674',
    '#584b80',
    '#704f87',
    '#895289',
    '#a35488',
    '#bd5585',
    '#d6567f',
    '#e75f71',
    '#ef7061',
    '#f38150',
    '#f59340',
    '#f5a52d',
    '#f2b712',
  ],
  [
    '#444674',
    '#574b80',
    '#6d4e87',
    '#855189',
    '#9d5389',
    '#b35586',
    '#ca5682',
    '#e2577b',
    '#eb666a',
    '#f0765b',
    '#f4854d',
    '#f6953e',
    '#f5a62c',
    '#f2b712',
  ],
  [
    '#444674',
    '#564a7f',
    '#694e86',
    '#805089',
    '#955389',
    '#ab5487',
    '#c15584',
    '#d6567f',
    '#e65d73',
    '#ed6c65',
    '#f27a58',
    '#f5894a',
    '#f6983b',
    '#f5a72b',
    '#f2b712',
  ],
  [
    '#444674',
    '#544a7f',
    '#674d85',
    '#7a5088',
    '#8f5289',
    '#a35488',
    '#b85586',
    '#cd5681',
    '#e1567c',
    '#e9626e',
    '#ef7061',
    '#f37d54',
    '#f58c46',
    '#f69a39',
    '#f5a829',
    '#f2b712',
  ],
  [
    '#444674',
    '#524a7e',
    '#644d85',
    '#784f88',
    '#895289',
    '#9e5389',
    '#b05587',
    '#c45683',
    '#d6567f',
    '#e55b76',
    '#ec6868',
    '#f0745c',
    '#f38150',
    '#f58e44',
    '#f69b38',
    '#f4a928',
    '#f2b712',
  ],
  [
    '#444674',
    '#524a7e',
    '#624d84',
    '#744f88',
    '#865189',
    '#985389',
    '#aa5488',
    '#bc5585',
    '#cd5681',
    '#df567c',
    '#e86070',
    '#ed6c64',
    '#f17959',
    '#f4854e',
    '#f59242',
    '#f59e35',
    '#f4aa27',
    '#f2b712',
  ],
] as const;

type ChartColorPalette = typeof CHART_PALETTE;
type ColorLength = (typeof CHART_PALETTE)['length'];

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

const generateTokens = (colors: Colors) => ({
  content: {
    primary: colors.gray400, // theme.textColor
    muted: colors.gray300, // theme.subText
    accent: colors.purple400, // new
    promotion: colors.pink400, // new
    danger: colors.red400, // theme.errorText
    warning: colors.yellow400, // theme.warningText
    success: colors.green400, // theme.successText
  },
  graphics: {
    muted: colors.gray300,
    accent: colors.blue300,
    promotion: colors.pink300,
    danger: colors.red300,
    warning: colors.yellow300,
    success: colors.green300,
  },
  background: {
    primary: colors.surface300, // theme.background
    secondary: colors.surface200, // theme.backgroundSecondary
    tertiary: colors.surface100, // theme.backgroundTertiary
  },
  border: {
    primary: colors.gray200, // theme.border
    muted: colors.gray100, // theme.innerBorder
    accent: colors.purple300, // theme.focusBorder
    promotion: colors.pink400, // new
    danger: colors.red200, // theme.errorFocus
    warning: colors.yellow200, // theme.warningFocus
    success: colors.green200, // theme.successFocus
  },
});

const generateThemeAliases = (colors: Colors) => ({
  /**
   * Heading text color
   */
  headingColor: colors.gray500,

  /**
   * Primary text color
   */
  textColor: colors.gray400,

  /**
   * Text that should not have as much emphasis
   */
  subText: colors.gray300,

  /**
   * Background for the main content area of a page?
   */
  bodyBackground: colors.surface200,

  /**
   * Primary background color
   */
  background: colors.surface300,

  /**
   * Elevated background color
   */
  backgroundElevated: colors.surface400,

  /**
   * Secondary background color used as a slight contrast against primary background
   */
  backgroundSecondary: colors.surface200,

  /**
   * Tertiary background color used as a stronger contrast against primary background
   */
  backgroundTertiary: colors.surface100,

  /**
   * Background for the header of a page
   */
  headerBackground: colors.surface300,

  /**
   * Primary border color
   */
  border: colors.gray200,
  translucentBorder: colors.translucentGray200,

  /**
   * Inner borders, e.g. borders inside of a grid
   */
  innerBorder: colors.gray100,
  translucentInnerBorder: colors.translucentGray100,

  /**
   * A color that denotes a "success", or something good
   */
  success: colors.green300,
  successText: colors.green400,
  successFocus: colors.green200,

  /**
   * A color that denotes an error, or something that is wrong
   */
  error: colors.red300,
  errorText: colors.red400,
  errorFocus: colors.red200,

  /**
   * A color that denotes danger, for dangerous actions like deletion
   */
  danger: colors.red300,
  dangerText: colors.red400,
  dangerFocus: colors.red200,

  /**
   * A color that denotes a warning
   */
  warning: colors.yellow300,
  warningText: colors.yellow400,
  warningFocus: colors.yellow200,

  /**
   * A color that indicates something is disabled where user can not interact or use
   * it in the usual manner (implies that there is an "enabled" state)
   */
  disabled: colors.gray300,
  disabledBorder: colors.gray200,

  /**
   * Hover color. Deprecated – use core components with built-in interaction states
   * @deprecated
   */
  hover: colors.surface500,

  /**
   * Indicates that something is "active" or "selected"
   */
  active: colors.purple300,
  activeHover: colors.purple400,
  activeText: colors.purple400,

  /**
   * Indicates that something has "focus", which is different than "active" state as it is more temporal
   * and should be a bit subtler than active
   */
  focus: colors.purple200,
  focusBorder: colors.purple300,

  /**
   * Link color indicates that something is clickable
   */
  linkColor: colors.blue400,
  linkHoverColor: colors.blue400,
  linkUnderline: colors.blue200,
  linkFocus: colors.blue300,

  /**
   * Form placeholder text color
   */
  formPlaceholder: colors.gray300,

  /**
   *
   */
  rowBackground: colors.surface400,

  /**
   * Color of lines that flow across the background of the chart to indicate axes levels
   * (This should only be used for yAxis)
   */
  chartLineColor: colors.gray100,

  /**
   * Color for chart label text
   */
  chartLabel: colors.gray300,

  /**
   * Color for the 'others' series in topEvent charts
   */
  chartOther: colors.gray200,

  /**
   * Hover color of the drag handle used in the content slider diff view.
   */
  diffSliderDragHandleHover: colors.purple400,

  /**
   * Default Progressbar color
   */
  progressBar: colors.purple300,

  /**
   * Default Progressbar color
   */
  progressBackground: colors.gray100,

  /**
   * Tag progress bars
   */
  tagBarHover: colors.purple200,
  tagBar: colors.gray200,

  /**
   * Search filter "token" background
   */
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

type Alert = 'muted' | 'info' | 'warning' | 'success' | 'error';

type AlertColors = Record<
  Alert,
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

export const generateThemeUtils = (colors: Colors, aliases: Aliases) => ({
  tooltipUnderline: (underlineColor: ColorOrAlias = 'gray300') => ({
    textDecoration: 'underline' as const,
    textDecorationThickness: '0.75px',
    textUnderlineOffset: '1.25px',
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    textDecorationColor: colors[underlineColor] ?? aliases[underlineColor],
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

export const generateThemePrismVariables = (
  prismColors: typeof prismLight,
  blockBackground: string
) =>
  // eslint-disable-next-line @emotion/syntax-preference
  css({
    // block background differs based on light/dark mode
    '--prism-block-background': blockBackground,
    ...prismColors,
  });

export const generateButtonTheme = (colors: Colors, alias: Aliases): ButtonColors => ({
  default: {
    color: alias.textColor,
    colorActive: alias.textColor,
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
    background: colors.purple300,
    backgroundActive: colors.purple400,
    border: colors.purple300,
    borderActive: colors.purple300,
    borderTranslucent: colors.purple300,
    focusBorder: alias.focusBorder,
    focusShadow: alias.focus,
  },
  danger: {
    color: colors.white,
    colorActive: colors.white,
    background: colors.red300,
    backgroundActive: colors.red400,
    border: colors.red300,
    borderActive: colors.red300,
    borderTranslucent: colors.red300,
    focusBorder: colors.red300,
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
    borderTranslucent: alias.translucentInnerBorder,
    focusBorder: 'transparent',
    focusShadow: 'transparent',
  },
  transparent: {
    color: alias.textColor,
    colorActive: alias.textColor,
    background: 'transparent',
    backgroundActive: 'transparent',
    border: 'transparent',
    borderActive: 'transparent',
    borderTranslucent: 'transparent',
    focusBorder: 'transparent',
    focusShadow: 'transparent',
  },
});

export const generateAlertTheme = (colors: Colors, alias: Aliases): AlertColors => ({
  info: {
    border: colors.blue200,
    background: colors.blue300,
    color: colors.blue400,
    backgroundLight: colors.blue100,
    borderHover: colors.blue300,
  },
  success: {
    background: colors.green300,
    backgroundLight: colors.green100,
    border: colors.green200,
    borderHover: colors.green300,
    color: colors.green400,
  },
  muted: {
    background: colors.gray200,
    backgroundLight: alias.backgroundSecondary,
    border: alias.border,
    borderHover: alias.border,
    color: 'inherit',
  },
  warning: {
    background: colors.yellow300,
    backgroundLight: colors.yellow100,
    border: colors.yellow200,
    borderHover: colors.yellow300,
    color: colors.yellow400,
  },
  error: {
    background: colors.red300,
    backgroundLight: colors.red100,
    border: colors.red200,
    borderHover: colors.red300,
    color: colors.red400,
    textLight: colors.red200,
  },
});

export const generateLevelTheme = (colors: Colors): LevelColors => ({
  sample: colors.purple300,
  info: colors.blue300,
  warning: colors.yellow300,
  // Hardcoded legacy color (orange400). We no longer use orange anywhere
  // else in the app (except for the chart palette). This needs to be harcoded
  // here because existing users may still associate orange with the "error" level.
  error: '#FF7738',
  fatal: colors.red300,
  default: colors.gray300,
  unknown: colors.gray200,
});

export const generateTagTheme = (colors: Colors): TagColors => ({
  default: {
    background: colors.surface400,
    border: colors.translucentGray200,
    color: colors.gray400,
  },
  promotion: {
    background: colors.pink100,
    border: colors.pink100,
    color: colors.pink400,
  },
  highlight: {
    background: colors.purple100,
    border: colors.purple100,
    color: colors.purple400,
  },
  warning: {
    background: colors.yellow100,
    border: colors.yellow100,
    color: colors.yellow400,
  },
  success: {
    background: colors.green100,
    border: colors.green100,
    color: colors.green400,
  },
  error: {
    background: colors.red100,
    border: colors.red100,
    color: colors.red400,
  },
  info: {
    background: colors.purple100,
    border: colors.purple100,
    color: colors.purple400,
  },
  white: {
    background: colors.white,
    border: colors.white,
    color: colors.black,
  },
  black: {
    background: colors.black,
    border: colors.black,
    color: colors.white,
  },
});

/**
 * Theme definition
 */

/* eslint-disable typescript-sort-keys/interface */
interface Colors {
  black: string;
  white: string;

  lightModeBlack: string;
  lightModeWhite: string;

  surface100: string;
  surface200: string;
  surface300: string;
  surface400: string;

  translucentSurface100: string;
  translucentSurface200: string;

  /**
   * Hover color. Deprecated – use core components with built-in interaction states
   * @deprecated
   */
  surface500: string;

  gray500: string;
  gray400: string;
  gray300: string;
  gray200: string;
  gray100: string;

  /**
   * Alternative version of gray200 that's translucent.
   * Useful for borders on tooltips, popovers, and dialogs.
   */
  translucentGray200: string;
  translucentGray100: string;

  purple400: string;
  purple300: string;
  purple200: string;
  purple100: string;

  blue400: string;
  blue300: string;
  blue200: string;
  blue100: string;

  green400: string;
  green300: string;
  green200: string;
  green100: string;

  yellow400: string;
  yellow300: string;
  yellow200: string;
  yellow100: string;

  red400: string;
  red300: string;
  red200: string;
  red100: string;

  pink400: string;
  pink300: string;
  pink200: string;
  pink100: string;
}
/* eslint-enable typescript-sort-keys/interface */

const lightColors: Colors = {
  black: '#1D1127',
  white: '#FFFFFF',

  lightModeBlack: '#1D1127',
  lightModeWhite: '#FFFFFF',

  surface100: '#F5F3F7',
  surface200: '#F7F6F9',
  surface300: '#FFFFFF',
  surface400: '#FFFFFF',

  translucentSurface100: '#F5F3F7B6',
  translucentSurface200: '#FAF9FBE6',

  /**
   * Hover color. Deprecated – use core components with built-in interaction states
   * @deprecated
   */
  surface500: '#F5F3F7',

  gray500: '#2B2233',
  gray400: '#3E3446',
  gray300: '#71637E',
  gray200: '#E0DCE5',
  gray100: '#F0ECF3',

  /**
   * Alternative version of gray200 that's translucent.
   * Useful for borders on tooltips, popovers, and dialogs.
   */
  translucentGray200: 'rgba(58, 17, 95, 0.14)',
  translucentGray100: 'rgba(45, 0, 85, 0.06)',

  purple400: '#6559C5',
  purple300: '#6C5FC7',
  purple200: 'rgba(108, 95, 199, 0.5)',
  purple100: 'rgba(108, 95, 199, 0.09)',

  blue400: '#2562D4',
  blue300: '#3C74DD',
  blue200: 'rgba(60, 116, 221, 0.5)',
  blue100: 'rgba(60, 116, 221, 0.09)',

  green400: '#207964',
  green300: '#2BA185',
  green200: 'rgba(43, 161, 133, 0.55)',
  green100: 'rgba(43, 161, 133, 0.11)',

  yellow400: '#856C00',
  yellow300: '#EBC000',
  yellow200: 'rgba(235, 192, 0, 0.7)',
  yellow100: 'rgba(235, 192, 0, 0.14)',

  red400: '#CF2126',
  red300: '#F55459',
  red200: 'rgba(245, 84, 89, 0.5)',
  red100: 'rgba(245, 84, 89, 0.1)',

  pink400: '#D1056B',
  pink300: '#F14499',
  pink200: 'rgba(249, 26, 138, 0.5)',
  pink100: 'rgba(249, 26, 138, 0.09)',
};

const darkColors: Colors = {
  black: '#1D1127',
  white: '#FFFFFF',

  lightModeBlack: '#FFFFFF',
  lightModeWhite: '#1D1127',

  surface100: '#18121C',
  surface200: '#1A141F',
  surface300: '#241D2A',
  surface400: '#2C2433',

  translucentSurface100: '#18121CB3',
  translucentSurface200: '#1A141FB3',

  /**
   * Hover color. Deprecated – use core components with built-in interaction states
   * @deprecated
   */
  surface500: '#362E3E',

  gray500: '#EBE6EF',
  gray400: '#D6D0DC',
  gray300: '#A398AE',
  gray200: '#393041',
  gray100: '#302735',

  /**
   * Alternative version of gray200 that's translucent.
   * Useful for borders on tooltips, popovers, and dialogs.
   */
  translucentGray200: 'rgba(218, 184, 245, 0.16)',
  translucentGray100: 'rgba(208, 168, 240, 0.07)',

  purple400: '#ABA0F8',
  purple300: '#7669D3',
  purple200: 'rgba(118, 105, 211, 0.27)',
  purple100: 'rgba(118, 105, 211, 0.11)',

  blue400: '#80ACFF',
  blue300: '#3070E8',
  blue200: 'rgba(48, 112, 232, 0.25)',
  blue100: 'rgba(48, 112, 232, 0.12)',

  green400: '#1CC49D',
  green300: '#1D876E',
  green200: 'rgba(29, 135, 110, 0.3)',
  green100: 'rgba(29, 135, 110, 0.12)',

  yellow400: '#C7B000',
  yellow300: '#A89500',
  yellow200: 'rgba(168, 149, 0, 0.25)',
  yellow100: 'rgba(168, 149, 0, 0.09)',

  red400: '#F98A8F',
  red300: '#E12D33',
  red200: 'rgba(225, 45, 51, 0.25)',
  red100: 'rgba(225, 45, 51, 0.15)',

  pink400: '#EB8FBC',
  pink300: '#CE3B85',
  pink200: 'rgba(206, 59, 133, 0.25)',
  pink100: 'rgba(206, 59, 133, 0.13)',
};

const prismLight = {
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

const prismDark = {
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

const lightShadows = {
  dropShadowLight: '0 0 1px rgba(43, 34, 51, 0.04)',
  dropShadowMedium: '0 1px 2px rgba(43, 34, 51, 0.04)',
  dropShadowHeavy: '0 4px 24px rgba(43, 34, 51, 0.12)',
  dropShadowHeavyTop: '0 -4px 24px rgba(43, 34, 51, 0.12)',
};

const darkShadows = {
  dropShadowLight: '0 0 1px rgba(10, 8, 12, 0.2)',
  dropShadowMedium: '0 1px 2px rgba(10, 8, 12, 0.2)',
  dropShadowHeavy: '0 4px 24px rgba(10, 8, 12, 0.36)',
  dropShadowHeavyTop: '0 -4px 24px rgba(10, 8, 12, 0.36)',
};

type Tag =
  | 'default'
  | 'promotion'
  | 'highlight'
  | 'warning'
  | 'success'
  | 'error'
  | 'info'
  // @TODO(jonasbadalic): What are white and black tags?
  | 'white'
  | 'black';

type TagColors = Record<
  Tag,
  {
    background: string;
    border: string;
    color: string;
  }
>;

// @TODO: is this loose coupling enough?
type Level = 'sample' | 'info' | 'warning' | 'error' | 'fatal' | 'default' | 'unknown';
type LevelColors = Record<Level, string>;

// @TODO(jonasbadalic): Disabled is not a button variant, it's a state
type Button = 'default' | 'primary' | 'danger' | 'link' | 'disabled' | 'transparent';
type ButtonColors = Record<
  Button,
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

type Breakpoint = 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge';
type Breakpoints = Record<Breakpoint, string>;

const breakpoints = {
  xsmall: '500px',
  small: '800px',
  medium: '992px',
  large: '1200px',
  xlarge: '1440px',
  xxlarge: '2560px',
} as const satisfies Breakpoints;

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

// @TODO: this needs to directly reference the icon direction
type IconDirection = 'up' | 'right' | 'down' | 'left';
const iconDirectionToAngle: Record<IconDirection, number> = {
  up: 0,
  right: 90,
  down: 180,
  left: 270,
} as const;

export type FormSize = 'xs' | 'sm' | 'md';

export type FormTheme = {
  form: Record<
    FormSize,
    {
      fontSize: string;
      height: string;
      lineHeight: string;
      minHeight: string;
    }
  >;
  formPadding: Record<
    FormSize,
    {
      paddingBottom: number;
      paddingLeft: number;
      paddingRight: number;
      paddingTop: number;
    }
  >;
  formRadius: Record<
    FormSize,
    {
      borderRadius: string;
    }
  >;
  formSpacing: Record<FormSize, string>;
};

const formTheme: FormTheme = {
  /**
   * Common styles for form inputs & buttons, separated by size.
   * Should be used to ensure consistent sizing among form elements.
   */
  form: {
    md: {
      height: '38px',
      minHeight: '38px',
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
      height: '26px',
      minHeight: '26px',
      fontSize: '0.75rem',
      lineHeight: '0.875rem',
    },
  },

  /**
   * Padding for form inputs
   * @TODO(jonasbadalic) This should exist on form component
   */
  formPadding: {
    md: {
      paddingLeft: 16,
      paddingRight: 12,
      paddingTop: 10,
      paddingBottom: 10,
    },
    sm: {
      paddingLeft: 12,
      paddingRight: 10,
      paddingTop: 8,
      paddingBottom: 8,
    },
    xs: {
      paddingLeft: 8,
      paddingRight: 6,
      paddingTop: 6,
      paddingBottom: 6,
    },
  },
  formRadius: {
    md: {
      borderRadius: '6px',
    },
    sm: {
      borderRadius: '6px',
    },
    xs: {
      borderRadius: '6px',
    },
  },
  formSpacing: {
    md: '8px',
    sm: '6px',
    xs: '4px',
  },
};

const iconSizes: Record<Size, string> = {
  xs: '12px',
  sm: '14px',
  md: '18px',
  lg: '24px',
  xl: '32px',
  '2xl': '72px',
} as const;

/**
 * Values shared between light and dark theme
 */
const commonTheme = {
  breakpoints,

  ...lightColors,
  ...lightShadows,

  // Icons
  iconSizes,
  iconDirections: iconDirectionToAngle,

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

  borderRadius: '6px',

  fontSize: {
    xs: '11px' as const,
    sm: '12px' as const,
    md: '14px' as const,
    lg: '16px' as const,
    xl: '18px' as const,
  },

  fontWeight: {
    normal: 400 as const,
    bold: 600 as const,
  },

  /**
   * @TODO(jonasbadalic) remove relative font sizes
   * @deprecated use fontSize instead
   */
  fontSizeRelativeSmall: '0.9em' as const,
  codeFontSize: '13px' as const,
  headerFontSize: '22px' as const,

  text: {
    family: "'Rubik', 'Avenir Next', sans-serif",
    familyMono: "'Roboto Mono', Monaco, Consolas, 'Courier New', monospace",
    lineHeightHeading: 1.2,
    lineHeightBody: 1.4,
  },

  tag: generateTagTheme(lightColors),
  level: generateLevelTheme(lightColors),
};

const lightTokens = generateTokens(lightColors);
const darkTokens = generateTokens(darkColors);

// Light and dark theme definitions
const lightAliases = generateThemeAliases(lightColors);
const darkAliases = generateThemeAliases(darkColors);

/**
 * @deprecated use useTheme hook instead of directly importing the theme. If you require a theme for your tests, use ThemeFixture.
 */
export const lightTheme = {
  isChonk: false,
  ...commonTheme,
  ...formTheme,
  ...lightColors,
  ...lightAliases,
  ...lightShadows,
  tokens: lightTokens,
  inverted: {
    ...darkColors,
    ...darkAliases,
    tokens: darkTokens,
  },
  ...generateThemeUtils(lightColors, lightAliases),
  alert: generateAlertTheme(lightColors, lightAliases),
  button: generateButtonTheme(lightColors, lightAliases),
  tag: generateTagTheme(lightColors),
  level: generateLevelTheme(lightColors),
  stacktraceActiveBackground: lightColors.gray500,
  stacktraceActiveText: lightColors.white,
  tour: {
    background: darkColors.surface400,
    header: darkColors.white,
    text: darkAliases.textColor,
    next: lightAliases.textColor,
    previous: darkColors.white,
    close: lightColors.white,
  },
  chart: {
    colors: CHART_PALETTE,
    getColorPalette: makeChartColorPalette(CHART_PALETTE),
  },
  prismVariables: generateThemePrismVariables(
    prismLight,
    lightAliases.backgroundSecondary
  ),
  prismDarkVariables: generateThemePrismVariables(
    prismDark,
    darkAliases.backgroundElevated
  ),
  sidebar: {
    // @TODO(jonasbadalic) What are these colors and where do they come from?
    background: '#2f1937',
    scrollbarThumbColor: '#A0A0A0',
    scrollbarColorTrack: 'rgba(45,26,50,92.42)', // end of the gradient which is used for background
    gradient: `linear-gradient(294.17deg, #2f1937 35.57%,#452650 92.42%,#452650 92.42%)`,
    border: 'transparent',
    superuser: '#880808',
  },
};

/**
 * @deprecated use useTheme hook instead of directly importing the theme. If you require a theme for your tests, use ThemeFixture.
 */
export const darkTheme: typeof lightTheme = {
  isChonk: false,
  ...commonTheme,
  ...formTheme,
  ...darkColors,
  ...darkAliases,
  ...darkShadows,
  tokens: darkTokens,
  inverted: {
    ...lightColors,
    ...lightAliases,
    tokens: lightTokens,
  },
  ...generateThemeUtils(darkColors, darkAliases),
  alert: generateAlertTheme(darkColors, darkAliases),
  button: generateButtonTheme(darkColors, darkAliases),
  tag: generateTagTheme(darkColors),
  level: generateLevelTheme(darkColors),
  prismVariables: generateThemePrismVariables(prismDark, darkAliases.backgroundSecondary),
  prismDarkVariables: generateThemePrismVariables(
    prismDark,
    darkAliases.backgroundSecondary
  ),
  stacktraceActiveBackground: darkColors.gray200,
  stacktraceActiveText: darkColors.white,
  tour: {
    background: darkColors.purple300,
    header: darkColors.white,
    text: darkAliases.textColor,
    next: lightAliases.textColor,
    previous: darkColors.white,
    close: lightColors.white,
  },
  chart: {
    colors: CHART_PALETTE,
    getColorPalette: makeChartColorPalette(CHART_PALETTE),
  },
  sidebar: {
    // @TODO(jonasbadalic) What are these colors and where do they come from?
    background: '#181622',
    scrollbarThumbColor: '#808080',
    scrollbarColorTrack: '#1B1825', // end of the gradient which is used for background
    gradient: `linear-gradient(180deg, #181622 0%, #1B1825 100%)`,
    border: darkAliases.border,
    superuser: '#620808',
  },
};

export type ColorMapping = typeof lightColors;
export type Color = keyof typeof lightColors;
export type IconSize = Size;
export type Aliases = typeof lightAliases;
export type ColorOrAlias = keyof Aliases | Color;
export type Theme = typeof lightTheme;

export type StrictCSSObject = {
  [K in keyof CSSProperties]?: CSSProperties[K]; // Enforce standard CSS properties
} & Partial<{
  [key: `&${string}`]: StrictCSSObject; // Allow nested selectors
  [key: `> ${string}:last-child`]: StrictCSSObject; // Allow some nested selectors
  [key: `> ${string}:first-child`]: StrictCSSObject; // Allow some nested selectors
}>;

/**
 * Do not import theme values directly as they only define light color theme.
 * Consuming it directly means that you won't get the correct colors in dark mode.
 * @deprecated use useTheme hook instead.
 */
const commonThemeExport = {...commonTheme};
/**
 * @deprecated Do not import the theme directly, use useTheme hook instead.
 */
export default commonThemeExport;
