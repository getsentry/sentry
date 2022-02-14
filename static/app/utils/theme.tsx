import '@emotion/react';

import color from 'color';

import CHART_PALETTE from 'sentry/constants/chartPalette';
import {DataCategory} from 'sentry/types';

/**
 * Exporting for use in Storybook only. Do not import this
 * anywhere else! Instead, use the theme prop or import useTheme.
 */
export const lightColors = {
  black: '#1D1127',
  white: '#FFFFFF',

  surface100: '#FAF9FB',
  surface200: '#FFFFFF',
  surface300: '#FFFFFF',
  surface400: '#F5F3F7',

  gray500: '#2B2233',
  gray400: '#3E3446',
  gray300: '#80708F',
  gray200: '#DBD6E1',
  gray100: '#EBE6EF',

  /**
   * Alternative version of gray200 that's translucent.
   * Useful for borders on tooltips, popovers, and dialogs.
   */
  translucentGray200: 'rgba(58, 17, 95, 0.18)',
  translucentGray100: 'rgba(45, 0, 85, 0.1)',

  purple400: '#584AC0',
  purple300: '#6C5FC7',
  purple200: 'rgba(108, 95, 199, 0.5)',
  purple100: 'rgba(108, 95, 199, 0.1)',

  blue400: '#2562D4',
  blue300: '#3C74DD',
  blue200: 'rgba(60, 116, 221, 0.5)',
  blue100: 'rgba(60, 116, 221, 0.09)',

  green400: '#268D75',
  green300: '#2BA185',
  green200: 'rgba(43, 161, 133, 0.55)',
  green100: 'rgba(43, 161, 133, 0.13)',

  yellow400: '#E5A500',
  yellow300: '#F5B000',
  yellow200: 'rgba(245, 176, 0, 0.55)',
  yellow100: 'rgba(245, 176, 0, 0.08)',

  red400: '#F32F35',
  red300: '#F55459',
  red200: 'rgba(245, 84, 89, 0.5)',
  red100: 'rgba(245, 84, 89, 0.09)',

  pink400: '#E50675',
  pink300: '#F91A8A',
  pink200: 'rgba(249, 26, 138, 0.5)',
  pink100: 'rgba(249, 26, 138, 0.1)',
};

/**
 * Exporting for use in Storybook only. Do not import this
 * anywhere else! Instead, use the theme prop or import useTheme.
 */
export const darkColors = {
  black: '#1D1127',
  white: '#FFFFFF',

  surface100: '#1A141F',
  surface200: '#241D2A',
  surface300: '#2C2433',
  surface400: '#362E3E',

  gray500: '#EBE6EF',
  gray400: '#D6D0DC',
  gray300: '#998DA5',
  gray200: '#43384C',
  gray100: '#342B3B',

  /**
   * Alternative version of gray200 that's translucent.
   * Useful for borders on tooltips, popovers, and dialogs.
   */
  translucentGray200: 'rgba(218, 184, 245, 0.18)',
  translucentGray100: 'rgba(208, 168, 240, 0.1)',

  purple400: '#6859CF',
  purple300: '#7669D3',
  purple200: 'rgba(108, 95, 199, 0.6)',
  purple100: 'rgba(118, 105, 211, 0.1)',

  blue400: '#4284FF',
  blue300: '#5C95FF',
  blue200: 'rgba(92, 149, 255, 0.4)',
  blue100: 'rgba(92, 149, 255, 0.1)',

  green400: '#26B593',
  green300: '#2AC8A3',
  green200: 'rgba(42, 200, 163, 0.4)',
  green100: 'rgba(42, 200, 163, 0.1)',

  yellow400: '#F5B000',
  yellow300: '#FFC227',
  yellow200: 'rgba(255, 194, 39, 0.35)',
  yellow100: 'rgba(255, 194, 39, 0.07)',

  red400: '#FA2E34',
  red300: '#FA4F54',
  red200: 'rgba(250, 79, 84, 0.4)',
  red100: 'rgba(250, 79, 84, 0.1)',

  pink400: '#C4317A',
  pink300: '#D1478C',
  pink200: 'rgba(209, 71, 140, 0.55)',
  pink100: 'rgba(209, 71, 140, 0.13)',
};

const lightShadows = {
  dropShadowLightest: '0 0 2px rgba(43, 34, 51, 0.04)',
  dropShadowLight: '0 1px 4px rgba(43, 34, 51, 0.04)',
  dropShadowHeavy: '0 4px 24px rgba(43, 34, 51, 0.12)',
};

const darkShadows = {
  dropShadowLightest: '0 0 2px rgba(10, 8, 12, 0.2)',
  dropShadowLight: '0 1px 4px rgba(10, 8, 12, 0.2)',
  dropShadowHeavy: '0 4px 24px rgba(10, 8, 12, 0.36)',
};

/**
 * Background used in the theme-color meta tag
 * The colors below are an approximation of the colors used in the sidebar (sidebarGradient).
 * Unfortunately the exact colors cannot be used, as the theme-color tag does not support linear-gradient()
 */
const sidebarBackground = {
  light: '#2f1937',
  dark: '#181622',
};

type BaseColors = typeof lightColors;

const generateAliases = (colors: BaseColors) => ({
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
  bodyBackground: colors.surface100,

  /**
   * Primary background color
   */
  background: colors.surface200,

  /**
   * Elevated background color
   */
  backgroundElevated: colors.surface300,

  /**
   * Secondary background color used as a slight contrast against primary background
   */
  backgroundSecondary: colors.surface100,

  /**
   * Background for the header of a page
   */
  headerBackground: colors.surface200,

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

  /**
   * A color that denotes an error, or something that is wrong
   */
  error: colors.red300,
  errorText: colors.red400,

  /**
   * A color that indicates something is disabled where user can not interact or use
   * it in the usual manner (implies that there is an "enabled" state)
   */
  disabled: colors.gray300,
  disabledBorder: colors.gray200,

  /**
   * Indicates a "hover" state, to suggest that an interactive element is clickable
   */
  hover: colors.surface400,

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
  linkColor: colors.blue300,
  linkHoverColor: colors.blue300,

  /**
   * Form placeholder text color
   */
  formPlaceholder: colors.gray300,

  /**
   * Default form text color
   */
  formText: colors.gray400,

  /**
   * Form input border
   */
  formInputBorder: colors.gray200,

  /**
   *
   */
  rowBackground: colors.surface300,

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
  overlayBackgroundAlpha: color(colors.surface100).alpha(0.7).string(),

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
    validActive: color(colors.blue100).opaquer(0.2).string(),
    invalid: colors.red100,
    invalidActive: color(colors.red100).opaquer(0.2).string(),
  },

  /**
   * Search filter "token" border
   */
  searchTokenBorder: {
    valid: colors.blue200,
    validActive: color(colors.blue200).opaquer(0.4).string(),
    invalid: colors.red200,
    invalidActive: color(colors.red200).opaquer(0.4).string(),
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

const dataCategory = {
  [DataCategory.ERRORS]: CHART_PALETTE[4][3],
  [DataCategory.TRANSACTIONS]: CHART_PALETTE[4][2],
  [DataCategory.ATTACHMENTS]: CHART_PALETTE[4][1],
  [DataCategory.DEFAULT]: CHART_PALETTE[4][0],
};

const generateAlertTheme = (colors: BaseColors, alias: Aliases) => ({
  muted: {
    background: colors.gray200,
    backgroundLight: alias.backgroundSecondary,
    border: alias.border,
    iconColor: 'inherit',
  },
  info: {
    background: colors.blue300,
    backgroundLight: colors.blue100,
    border: colors.blue200,
    iconColor: colors.blue300,
  },
  warning: {
    background: colors.yellow300,
    backgroundLight: colors.yellow100,
    border: colors.yellow200,
    iconColor: colors.yellow300,
  },
  success: {
    background: colors.green300,
    backgroundLight: colors.green100,
    border: colors.green200,
    iconColor: colors.green300,
  },
  error: {
    background: colors.red300,
    backgroundLight: colors.red100,
    border: colors.red200,
    iconColor: colors.red300,
    textLight: colors.red200,
  },
});

const generateBadgeTheme = (colors: BaseColors) => ({
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
  review: {
    background: colors.purple300,
    indicatorColor: colors.purple300,
    color: colors.white,
  },
  warning: {
    background: colors.yellow300,
    indicatorColor: colors.yellow300,
    color: colors.gray500,
  },
});

const generateTagTheme = (colors: BaseColors) => ({
  default: {
    background: colors.surface400,
    border: colors.gray200,
    iconColor: colors.gray300,
  },
  promotion: {
    background: colors.pink100,
    border: colors.pink200,
    iconColor: colors.pink300,
  },
  highlight: {
    background: colors.purple100,
    border: colors.purple200,
    iconColor: colors.purple300,
  },
  warning: {
    background: colors.yellow100,
    border: colors.yellow200,
    iconColor: colors.yellow300,
  },
  success: {
    background: colors.green100,
    border: colors.green200,
    iconColor: colors.green300,
  },
  error: {
    background: colors.red100,
    border: colors.red200,
    iconColor: colors.red300,
  },
  info: {
    background: colors.purple100,
    border: colors.purple200,
    iconColor: colors.purple300,
  },
  white: {
    background: colors.white,
    border: colors.white,
    iconColor: colors.black,
  },
  black: {
    background: colors.black,
    border: colors.black,
    iconColor: colors.white,
  },
});

const generateLevelTheme = (colors: BaseColors) => ({
  sample: colors.purple300,
  info: colors.blue300,
  warning: colors.yellow300,
  // Hardcoded legacy color (orange400). We no longer use orange anywhere
  // else in the app (except for the chart palette). This needs to be harcoded
  // here because existing users may still associate orange with the "error" level.
  error: '#FF7738',
  fatal: colors.red300,
  default: colors.gray300,
});

const generateButtonTheme = (colors: BaseColors, alias: Aliases) => ({
  borderRadius: '4px',

  default: {
    color: alias.textColor,
    colorActive: alias.textColor,
    background: alias.background,
    backgroundActive: alias.backgroundSecondary,
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
  success: {
    color: colors.white,
    colorActive: colors.white,
    background: colors.green300,
    backgroundActive: colors.green400,
    border: colors.green300,
    borderActive: colors.green300,
    borderTranslucent: colors.green300,
    focusBorder: colors.green300,
    focusShadow: colors.green200,
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
    color: colors.blue300,
    colorActive: colors.blue300,
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
  form: {
    color: alias.textColor,
    colorActive: alias.textColor,
    background: alias.background,
    backgroundActive: alias.backgroundSecondary,
    border: alias.formInputBorder,
    borderActive: alias.formInputBorder,
    borderTranslucent: alias.translucentBorder,
    focusBorder: alias.focusBorder,
    focusShadow: alias.focus,
  },
});

const iconSizes = {
  xs: '12px',
  sm: '16px',
  md: '20px',
  lg: '24px',
  xl: '32px',
  xxl: '72px',
};

const commonTheme = {
  breakpoints: ['800px', '992px', '1200px', '1440px', '2560px'],

  ...lightColors,

  ...lightShadows,

  iconSizes,

  iconDirections: {
    up: '0',
    right: '90',
    down: '180',
    left: '270',
  },

  // Try to keep these ordered plz
  zIndex: {
    // Generic z-index when you hope your component is isolated and
    // does not need to battle others for z-index priority
    initial: 1,

    truncationFullValue: 10,

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
      actor: 1008,
    },

    globalSelectionHeader: 1009,

    settingsSidebarNavMask: 1017,
    settingsSidebarNav: 1018,
    sidebarPanel: 1019,
    sidebar: 1020,
    orgAndUserMenu: 1030,

    // Sentry user feedback modal
    sentryErrorEmbed: 1090,

    // If you change modal also update shared-components.less
    // as the z-index for bootstrap modals lives there.
    modal: 10000,
    toast: 10001,

    // tooltips and hovercards can be inside modals sometimes.
    hovercard: 10002,
    tooltip: 10003,

    // On mobile views org stats dropdowns overlap
    orgStats: {
      dataCategory: 2,
      timeRange: 1,
    },

    // On mobile views issue list dropdowns overlap
    issuesList: {
      stickyHeader: 1,
      sortOptions: 2,
      displayOptions: 3,
    },
  },

  grid: 8,

  borderRadius: '4px',
  borderRadiusBottom: '0 0 4px 4px',
  borderRadiusTop: '4px 4px 0 0',
  borderRadiusLeft: '4px 0 0 4px',
  borderRadiusRight: '0 4px 4px 0',

  headerSelectorRowHeight: 44,
  headerSelectorLabelHeight: 28,

  // Relative font sizes
  fontSizeRelativeSmall: '0.9em',

  fontSizeExtraSmall: '11px',
  fontSizeSmall: '12px',
  fontSizeMedium: '14px',
  fontSizeLarge: '16px',
  fontSizeExtraLarge: '18px',
  headerFontSize: '22px',

  settings: {
    // Max-width for settings breadcrumbs
    // i.e. organization, project, or team
    maxCrumbWidth: '240px',

    containerWidth: '1440px',
    headerHeight: '69px',
    sidebarWidth: '220px',
  },

  sidebar: {
    boxShadow: '0 3px 3px #2f2936',
    color: '#9586a5',
    divider: '#493e54',
    badgeSize: '22px',
    smallBadgeSize: '11px',
    collapsedWidth: '70px',
    expandedWidth: '220px',
    mobileHeight: '54px',
    menuSpacing: '15px',
  },

  text: {
    family: '"Rubik", "Avenir Next", sans-serif',
    familyMono: '"Roboto Mono", Monaco, Consolas, "Courier New", monospace',
    lineHeightHeading: 1.2,
    lineHeightBody: 1.4,
    pageTitle: {
      fontSize: '1.625rem',
      fontWeight: 600,
      letterSpacing: '-0.01em',
      lineHeight: 1.2,
    },
    cardTitle: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.2,
    },
  },

  /**
   * Common styles for form inputs & buttons, separated by size.
   * Should be used to ensure consistent sizing among form elements.
   */
  form: {
    default: {
      height: 40,
      minHeight: 40,
      fontSize: '0.875rem',
      lineHeight: '1rem',
    },
    small: {
      height: 34,
      minHeight: 34,
      fontSize: '0.875rem',
      lineHeight: '1rem',
    },
    xsmall: {
      height: 28,
      minHeight: 28,
      fontSize: '0.75rem',
      lineHeight: '0.875rem',
    },
  },

  /**
   * Padding for buttons
   */
  buttonPadding: {
    default: {
      paddingTop: 10,
      paddingBottom: 10,
      paddingLeft: 16,
      paddingRight: 16,
    },
    small: {
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 12,
      paddingRight: 12,
    },
    xsmall: {
      paddingTop: 6,
      paddingBottom: 6,
      paddingLeft: 8,
      paddingRight: 8,
    },
  },

  dataCategory,

  tag: generateTagTheme(lightColors),

  level: generateLevelTheme(lightColors),

  charts: {
    colors: CHART_PALETTE[CHART_PALETTE.length - 1],

    // We have an array that maps `number + 1` --> list of `number` colors
    getColorPalette: (length: number) =>
      CHART_PALETTE[Math.min(CHART_PALETTE.length - 1, length + 1)] as string[],

    previousPeriod: lightColors.gray200,
    symbolSize: 6,
  },

  diff: {
    removedRow: 'hsl(358deg 89% 65% / 15%)',
    removed: 'hsl(358deg 89% 65% / 30%)',
    addedRow: 'hsl(100deg 100% 87% / 18%)',
    added: 'hsl(166deg 58% 47% / 32%)',
  },

  // Similarity spectrum used in "Similar Issues" in group details
  similarity: {
    empty: '#e2dee6',
    colors: ['#ec5e44', '#f38259', '#f9a66d', '#98b480', '#57be8c'],
  },

  // used as a gradient,
  businessIconColors: ['#EA5BC2', '#6148CE'],

  demo: {
    headerSize: '70px',
  },
};

const lightAliases = generateAliases(lightColors);
const darkAliases = generateAliases(darkColors);

export const lightTheme = {
  ...commonTheme,
  ...lightColors,
  ...lightAliases,
  ...lightShadows,
  inverted: {
    ...darkColors,
    ...darkAliases,
  },
  alert: generateAlertTheme(lightColors, lightAliases),
  badge: generateBadgeTheme(lightColors),
  button: generateButtonTheme(lightColors, lightAliases),
  tag: generateTagTheme(lightColors),
  level: generateLevelTheme(lightColors),
  sidebar: {
    ...commonTheme.sidebar,
    background: sidebarBackground.light,
  },
  sidebarGradient: `linear-gradient(294.17deg,${sidebarBackground.light} 35.57%,#452650 92.42%,#452650 92.42%)`,
  sidebarBorder: 'transparent',
};

export const darkTheme: Theme = {
  ...commonTheme,
  ...darkColors,
  ...darkAliases,
  ...darkShadows,
  inverted: {
    ...lightColors,
    ...lightAliases,
  },
  alert: generateAlertTheme(darkColors, darkAliases),
  badge: generateBadgeTheme(darkColors),
  button: generateButtonTheme(darkColors, darkAliases),
  tag: generateTagTheme(darkColors),
  level: generateLevelTheme(darkColors),
  sidebar: {
    ...commonTheme.sidebar,
    background: sidebarBackground.dark,
  },
  sidebarGradient: `linear-gradient(180deg, ${sidebarBackground.dark} 0%, #1B1825 100%)`,
  sidebarBorder: darkAliases.border,
};

export type Theme = typeof lightTheme;
export type Aliases = typeof lightAliases;

export type Color = keyof typeof lightColors;
export type IconSize = keyof typeof iconSizes;

export default commonTheme;

type MyTheme = Theme;

/**
 * Configure Emotion to use our theme
 */
declare module '@emotion/react' {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  export interface Theme extends MyTheme {}
}

// This should never be used directly (except in storybook)
export {lightAliases as aliases};
