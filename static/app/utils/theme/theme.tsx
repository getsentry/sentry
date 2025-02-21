/**
 * This file is the source of truth for the theme,
 * it is roughly split into the following sections:
 *
 * - Theme helpers (color generation and aliases)
 * - Common type definitions for certain fields like button kinds and variants
 * - Light and dark theme definitions
 * - Theme type exports
 */
import {css} from '@emotion/react';
import color from 'color';

import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {type DataCategory, Outcome} from 'sentry/types/core';

export const generateThemeAliases = (colors: Colors) => ({
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
   * Indicates a "hover" state. Deprecated – use `InteractionStateLayer` instead for
   * interaction (hover/press) states.
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
   * Inactive
   */
  inactive: colors.gray300,

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
   * Default form text color
   */
  formText: colors.gray400,

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
   * Default Progressbar color
   */
  progressBar: colors.purple300,

  /**
   * Default Progressbar color
   */
  progressBackground: colors.gray100,

  /**
   * Overlay for partial opacity
   */
  overlayBackgroundAlpha: color(colors.surface200).alpha(0.7).string(),

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
   * Count on button when active
   */
  buttonCountActive: colors.white,

  /**
   * Count on button
   */
  buttonCount: colors.gray500,

  /**
   * Background of alert banners at the top
   */
  bannerBackground: colors.gray500,
});

type Alert = 'muted' | 'info' | 'warning' | 'success' | 'error';

type AlertColors = {
  [key in Alert]: {
    background: string;
    backgroundLight: string;
    border: string;
    borderHover: string;
    color: string;
    // @TODO(jonasbadalic): Why is textLight optional and only set on error?
    textLight?: string;
  };
};

export const generateThemeUtils = (colors: Colors, aliases: Aliases) => ({
  tooltipUnderline: (underlineColor: ColorOrAlias = 'gray300') => ({
    textDecoration: `underline dotted ${
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      colors[underlineColor] ?? aliases[underlineColor]
    }`,
    textDecorationThickness: '0.75px',
    textUnderlineOffset: '1.25px',
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

export const generateBadgeTheme = (colors: Colors): BadgeColors => ({
  default: {
    background: colors.gray100,
    indicatorColor: colors.gray100,
    color: colors.gray500,
  },
  alpha: {
    background: `linear-gradient(90deg, ${colors.pink300}, ${colors.yellow300})`,
    indicatorColor: colors.pink300,
    color: colors.white,
  },
  beta: {
    background: `linear-gradient(90deg, ${colors.purple300}, ${colors.pink300})`,
    indicatorColor: colors.purple300,
    color: colors.white,
  },
  new: {
    background: `linear-gradient(90deg, ${colors.blue300}, ${colors.green300})`,
    indicatorColor: colors.green300,
    color: colors.white,
  },
  experimental: {
    background: colors.gray100,
    indicatorColor: colors.gray100,
    color: colors.gray500,
  },
  internal: {
    background: colors.gray100,
    indicatorColor: colors.gray100,
    color: colors.gray500,
  },
  warning: {
    background: colors.yellow300,
    indicatorColor: colors.yellow300,
    color: colors.gray500,
  },
  gray: {
    background: `rgba(43, 34, 51, 0.08)`,
    indicatorColor: `rgba(43, 34, 51, 0.08)`,
    color: colors.gray500,
  },
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
   * Hover color. Deprecated – use <InteractionStateLayer /> instead for interaction
   * (hover/press) states.
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
  surface200: '#FAF9FB',
  surface300: '#FFFFFF',
  surface400: '#FFFFFF',

  translucentSurface100: '#F5F3F7B6',
  translucentSurface200: '#FAF9FBE6',

  /**
   * Hover color. Deprecated – use <InteractionStateLayer /> instead for interaction
   * (hover/press) states.
   * @deprecated
   */
  surface500: '#F5F3F7',

  gray500: '#2B2233',
  gray400: '#3E3446',
  gray300: '#80708F',
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
   * Hover color. Deprecated – use <InteractionStateLayer /> instead for interaction
   * (hover/press) states.
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

type Badge =
  | 'default'
  | 'alpha'
  | 'beta'
  | 'warning'
  | 'new'
  | 'experimental'
  // @TODO(jonasbadalic): What is gray a tag type?
  | 'gray'
  | 'internal';

type BadgeColors = {
  [key in Badge]: {
    background: string;
    color: string;
    indicatorColor: string;
  };
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

type TagColors = {
  [key in Tag]: {
    background: string;
    border: string;
    color: string;
  };
};

// @TODO: is this loose coupling enough?
type Level = 'sample' | 'info' | 'warning' | 'error' | 'fatal' | 'default' | 'unknown';
type LevelColors = {
  [key in Level]: string;
};

// @TODO(jonasbadalic): Disabled is not a button variant, it's a state
type Button = 'default' | 'primary' | 'danger' | 'link' | 'disabled';
type ButtonColors = {
  [key in Button]: {
    background: string;
    backgroundActive: string;
    border: string;
    borderActive: string;
    borderTranslucent: string;
    color: string;
    colorActive: string;
    focusBorder: string;
    focusShadow: string;
  };
};

type ButtonSize = 'md' | 'sm' | 'xs';
type ButtonPaddingSizes = {
  [key in ButtonSize]: {
    paddingBottom: number;
    paddingLeft: number;
    paddingRight: number;
    paddingTop: number;
  };
};
const buttonPaddingSizes: ButtonPaddingSizes = {
  md: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 10,
    paddingBottom: 10,
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
};

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

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
type Sizes = {
  [key in Size]: string;
};
const iconNumberSizes: Record<Size, number> = {
  xs: 12,
  sm: 14,
  md: 18,
  lg: 24,
  xl: 32,
  xxl: 72,
} as const;

// @TODO: this needs to directly reference the icon direction
type IconDirection = 'up' | 'right' | 'down' | 'left';
const iconDirectionToAngle: Record<IconDirection, number> = {
  up: 0,
  right: 90,
  down: 180,
  left: 270,
} as const;

export type FormSize = 'xs' | 'sm' | 'md';

type FormSizes = {
  [key in FormSize]: {
    fontSize: string;
    height: number;
    lineHeight: string;
    minHeight: number;
  };
};

const formSizes: FormSizes = {
  md: {
    height: 38,
    minHeight: 38,
    fontSize: '0.875rem',
    lineHeight: '1rem',
  },
  sm: {
    height: 32,
    minHeight: 32,
    fontSize: '0.875rem',
    lineHeight: '1rem',
  },
  xs: {
    height: 26,
    minHeight: 26,
    fontSize: '0.75rem',
    lineHeight: '0.875rem',
  },
} as const;

type FormPaddingSizes = {
  [key in FormSize]: {
    paddingBottom: number;
    paddingLeft: number;
    paddingRight: number;
    paddingTop: number;
  };
};
const formPaddingSizes: FormPaddingSizes = {
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
};

const iconSizes: Sizes = {
  xs: `${iconNumberSizes.xs}px`,
  sm: `${iconNumberSizes.sm}px`,
  md: `${iconNumberSizes.md}px`,
  lg: `${iconNumberSizes.lg}px`,
  xl: `${iconNumberSizes.xl}px`,
  xxl: `${iconNumberSizes.xxl}px`,
} as const;

// @TODO(jonasbadalic): This was missing profiles, profileChunks, profileDuration, spans, spansIndexed, uptime, what do we do with them?
const dataCategory: Record<
  Exclude<
    DataCategory,
    'profiles' | 'profileChunks' | 'profileDuration' | 'spans' | 'spansIndexed' | 'uptime'
  >,
  string
> = {
  [DATA_CATEGORY_INFO.error.plural]: CHART_PALETTE[4][3],
  [DATA_CATEGORY_INFO.transaction.plural]: CHART_PALETTE[4][2],
  [DATA_CATEGORY_INFO.attachment.plural]: CHART_PALETTE[4][1],
  [DATA_CATEGORY_INFO.replay.plural]: CHART_PALETTE[4][4],
  [DATA_CATEGORY_INFO.monitorSeat.plural]: '#a397f7',
};

/**
 * Default colors for data usage outcomes
 * @TODO(jonasbadalic): This was missing abuse and cardinality limited, what do we do with them?
 */
type OutcomeColors = Record<
  Exclude<Outcome, Outcome.ABUSE | Outcome.CARDINALITY_LIMITED>,
  string
>;

const outcome: OutcomeColors = {
  [Outcome.ACCEPTED]: CHART_PALETTE[5][0], // #444674 - chart 100
  [Outcome.FILTERED]: CHART_PALETTE[5][2], // #B85586 - chart 300
  [Outcome.RATE_LIMITED]: CHART_PALETTE[5][3], // #E9626E - chart 400
  [Outcome.INVALID]: CHART_PALETTE[5][4], // #F58C46 - chart 500
  [Outcome.CLIENT_DISCARD]: CHART_PALETTE[5][5], // #F2B712 - chart 600
  [Outcome.DROPPED]: CHART_PALETTE[5][3], // #F58C46 - chart 500
};

/**
 * Values shared between light and dark theme
 */
const commonTheme = {
  breakpoints,

  ...lightColors,
  ...lightShadows,

  // Icons
  iconSizes,
  iconNumberSizes,
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

    // On mobile views issue list dropdowns overlap
    issuesList: {
      stickyHeader: 2,
      sortOptions: 3,
      displayOptions: 4,
    },
  },

  borderRadius: '6px',

  // Relative font sizes
  // @TODO(jonasbadalic) why do we need these
  fontSizeRelativeSmall: '0.9em',
  fontSizeExtraSmall: '11px',
  fontSizeSmall: '12px',
  fontSizeMedium: '14px',
  fontSizeLarge: '16px',
  fontSizeExtraLarge: '18px',

  codeFontSize: '13px',
  headerFontSize: '22px',

  fontWeightNormal: 400,
  fontWeightBold: 600,

  text: {
    family: "'Rubik', 'Avenir Next', sans-serif",
    familyMono: "'Roboto Mono', Monaco, Consolas, 'Courier New', monospace",
    lineHeightHeading: 1.2,
    lineHeightBody: 1.4,
  },

  /**
   * Common styles for form inputs & buttons, separated by size.
   * Should be used to ensure consistent sizing among form elements.
   */
  form: formSizes,

  /**
   * Padding for buttons
   * @TODO(jonasbadalic) This should exist on button component
   */
  buttonPadding: buttonPaddingSizes,

  /**
   * Padding for form inputs
   * @TODO(jonasbadalic) This should exist on form component
   */
  formPadding: formPaddingSizes,

  tag: generateTagTheme(lightColors),
  level: generateLevelTheme(lightColors),

  // @TODO(jonasbadalic) Do these need to be here?
  outcome,
  dataCategory,

  charts: {
    // We have an array that maps `number + 1` --> list of `number` colors
    getColorPalette: (length: number) =>
      CHART_PALETTE[Math.min(CHART_PALETTE.length - 1, length + 1)],
  },
};

// Light and dark theme definitions
const lightAliases = generateThemeAliases(lightColors);
const darkAliases = generateThemeAliases(darkColors);

export const lightTheme = {
  isChonk: false,
  ...commonTheme,
  ...lightColors,
  ...lightAliases,
  ...lightShadows,
  inverted: {
    ...darkColors,
    ...darkAliases,
  },
  ...generateThemeUtils(lightColors, lightAliases),
  alert: generateAlertTheme(lightColors, lightAliases),
  badge: generateBadgeTheme(lightColors),
  button: generateButtonTheme(lightColors, lightAliases),
  tag: generateTagTheme(lightColors),
  level: generateLevelTheme(lightColors),
  stacktraceActiveBackground: lightColors.gray500,
  stacktraceActiveText: lightColors.white,
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

export const darkTheme: typeof lightTheme = {
  isChonk: false,
  ...commonTheme,
  ...darkColors,
  ...darkAliases,
  ...darkShadows,
  inverted: {
    ...lightColors,
    ...lightAliases,
  },
  ...generateThemeUtils(darkColors, darkAliases),
  alert: generateAlertTheme(darkColors, darkAliases),
  badge: generateBadgeTheme(darkColors),
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

/**
 * Do not import theme values directly as they only define light color theme.
 * Consuming it directly means that you won't get the correct colors in dark mode.
 * @deprecated use useTheme hook instead.
 */
const commonThemeExport = {...commonTheme};
export default commonThemeExport;
