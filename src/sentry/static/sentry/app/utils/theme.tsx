import color from 'color';

import CHART_PALETTE from 'app/constants/chartPalette';

const colors = {
  white: '#FFFFFF',
  black: '#1D1127',

  gray100: '#E7E1EC',
  gray200: '#C6BECF',
  gray300: '#9386A0',
  gray400: '#776589',
  gray500: '#2B1D38',

  yellow100: '#FDE8b4',
  yellow200: '#FFD577',
  yellow300: '#FFC227',

  purple100: '#D4D1EC',
  purple200: '#A396DA',
  purple300: '#6C5FC7',

  blue100: '#D2DFF7',
  blue200: '#6e9ef7',
  blue300: '#3D74DB',

  orange100: '#FFF1ED',
  orange200: '#F9C7B9',
  orange300: '#F69C7D',
  orange400: '#FF7738',
  orange500: '#BA4A23',

  red100: '#FCC6C8',
  red200: '#FD918F',
  red300: '#F55459',

  green100: '#B6ECDF',
  green200: '#7DD6BE',
  green300: '#33BF9E',

  pink100: '#FDC9D7',
  pink200: '#FA93AB',
  pink300: '#F05781',
} as const;

/**
 * This is not in the gray palette because it should [generally] only be used for backgrounds
 */
const backgroundSecondary = '#FAF9FB';

const aliases = {
  /**
   * Primary text color
   */
  textColor: colors.gray500,

  /**
   * Text that should not have as much emphasis
   */
  subText: colors.gray400,

  /**
   * Background for the main content area of a page?
   */
  bodyBackground: backgroundSecondary,

  /**
   * Primary background color
   */
  background: colors.white,

  /**
   * Secondary background color used as a slight contrast against primary background
   */
  backgroundSecondary,

  /**
   * Background for the header of a page
   */
  headerBackground: colors.white,

  /**
   * Primary border color
   */
  border: colors.gray200,

  /**
   * Inner borders, e.g. borders inside of a grid
   */
  innerBorder: colors.gray100,

  /**
   * A color that denotes a "success", or something good
   */
  success: colors.green300,

  /**
   * A color that denotes an error, or something that is wrong
   */
  error: colors.red300,

  /**
   * A color that indicates something is disabled where user can not interact or use
   * it in the usual manner (implies that there is an "enabled" state)
   */
  disabled: colors.gray200,

  /**
   * Indicates that something is "active" or "selected"
   */
  active: colors.purple300,

  /**
   * Indicates that something has "focus", which is different than "active" state as it is more temporal
   * and should be a bit subtler than active
   */
  focus: backgroundSecondary,

  /**
   * Inactive
   */
  inactive: colors.gray200,

  /**
   * Link color indicates that something is clickable
   */
  linkColor: colors.blue300,
  linkHoverColor: colors.blue300,

  /**
   * Secondary button colors
   */
  secondaryButtonBorder: colors.gray200,

  secondaryButtonText: colors.gray500,

  /**
   * Primary button colors
   */
  primaryButtonBorder: '#3d328e',
  primaryButtonBorderActive: '#352b7b',

  /**
   * Gradient for sidebar
   */
  sidebarGradient:
    'linear-gradient(294.17deg,#2f1937 35.57%,#452650 92.42%,#452650 92.42%)',

  /**
   * Form placeholder text color
   */
  formPlaceholder: colors.gray200,

  /**
   * Default form text color
   */
  formText: colors.gray500,

  /**
   * Form input border
   */
  formInputBorder: colors.gray200,

  /**
   *
   */
  rowBackground: backgroundSecondary,

  /**
   * Color of lines that flow across the background of the chart to indicate axes levels
   * (This should only be used for yAxis)
   */
  chartLineColor: colors.gray100,

  /**
   * Color for chart label text
   */
  chartLabel: colors.gray200,

  /**
   * Default Progressbar color
   */
  progressBar: colors.purple300,

  /**
   * Default Progressbar color
   */
  progressBackground: colors.gray100,

  /**
   * Background of alerts
   */
  alertBackgroundAlpha: 0.3,

  /**
   * Background of default badge (mainly used in NavTabs)
   */
  badgeBackground: colors.gray200,

  /**
   * Overlay for partial opacity
   */
  overlayBackgroundAlpha: 'rgba(255, 255, 255, 0.7)',
} as const;

const generateAlertTheme = alias => ({
  muted: {
    background: colors.gray200,
    backgroundLight: alias.backgroundSecondary,
    border: alias.border,
    iconColor: 'inherit',
  },
  info: {
    background: colors.blue300,
    backgroundLight: color(colors.blue100).alpha(alias.alertBackgroundAlpha).string(),
    border: colors.blue200,
    iconColor: colors.blue300,
  },
  warning: {
    background: colors.yellow300,
    backgroundLight: color(colors.yellow100).alpha(alias.alertBackgroundAlpha).string(),
    border: colors.yellow300,
    iconColor: colors.yellow300,
  },
  success: {
    background: colors.green300,
    backgroundLight: color(colors.green100).alpha(alias.alertBackgroundAlpha).string(),
    border: colors.green200,
    iconColor: colors.green300,
  },
  error: {
    background: colors.red300,
    backgroundLight: color(colors.red100).alpha(alias.alertBackgroundAlpha).string(),
    border: colors.red200,
    iconColor: colors.red300,
    textLight: colors.red200,
  },
});

const generateBadgeTheme = alias => ({
  default: {
    background: alias.badgeBackground,
    indicatorColor: alias.badgeBackground,
  },
  alpha: {
    background: colors.orange400,
    indicatorColor: colors.orange400,
  },
  beta: {
    background: `linear-gradient(90deg, ${colors.pink300}, ${colors.purple300})`,
    indicatorColor: colors.purple300,
  },
  new: {
    background: colors.green300,
    indicatorColor: colors.green300,
  },
});

const tag = {
  default: {
    background: colors.gray100,
    iconColor: colors.purple300,
  },
  promotion: {
    background: colors.orange100,
    iconColor: colors.orange400,
  },
  highlight: {
    background: colors.purple100,
    iconColor: colors.purple300,
  },
  warning: {
    background: colors.yellow100,
    iconColor: colors.yellow300,
  },
  success: {
    background: colors.green100,
    iconColor: colors.green300,
  },
  error: {
    background: colors.red100,
    iconColor: colors.red300,
  },
  info: {
    background: colors.blue100,
    iconColor: colors.blue300,
  },
  white: {
    background: colors.white,
    iconColor: colors.gray500,
  },
  black: {
    background: colors.gray500,
    iconColor: colors.white,
  },
};

const generateButtonTheme = alias => ({
  borderRadius: '3px',

  default: {
    color: alias.secondaryButtonText,
    colorActive: alias.secondaryButtonText,
    background: alias.background,
    backgroundActive: alias.background,
    border: alias.secondaryButtonBorder,
    borderActive: alias.secondaryButtonBorder,
    focusShadow: color(colors.gray200).alpha(0.5).string(),
  },
  primary: {
    color: colors.white,
    colorActive: colors.white,
    background: colors.purple300,
    backgroundActive: '#4e3fb4',
    border: alias.primaryButtonBorder,
    borderActive: alias.primaryButtonBorderActive,
    focusShadow: color(colors.purple300).alpha(0.4).string(),
  },
  success: {
    color: colors.white,
    colorActive: colors.white,
    background: '#3fa372',
    backgroundActive: colors.green300,
    border: '#7ccca5',
    borderActive: '#7ccca5',
    focusShadow: color(colors.green300).alpha(0.5).string(),
  },
  danger: {
    color: colors.white,
    colorActive: colors.white,
    background: colors.red300,
    backgroundActive: '#bf2a1d',
    border: '#bf2a1d',
    borderActive: '#7d1c13',
    focusShadow: color(colors.red300).alpha(0.5).string(),
  },
  link: {
    color: colors.blue300,
    colorActive: colors.blue300,
    background: 'transparent',
    border: false,
    borderActive: false,
    backgroundActive: 'transparent',
    focusShadow: false,
  },
  disabled: {
    color: alias.disabled,
    colorActive: alias.disabled,
    border: alias.disabled,
    borderActive: alias.disabled,
    background: alias.background,
    backgroundActive: alias.background,
    focusShadow: false,
  },
  form: {
    color: alias.textColor,
    colorActive: alias.textColor,
    background: alias.background,
    backgroundActive: alias.background,
    border: alias.formInputBorder,
    borderActive: alias.formInputBorder,
    focusShadow: false,
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

  ...colors,

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

    breadcrumbs: {
      header: 2,
      gridCellError: 1,
      iconWrapper: 1,
    },

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
  },

  grid: 8,

  borderRadius: '4px',
  borderRadiusBottom: '0 0 4px 4px',
  borderRadiusTop: '4px 4px 0 0',
  headerSelectorRowHeight: 44,
  headerSelectorLabelHeight: 28,

  dropShadowLightest: '0 1px 2px rgba(0, 0, 0, 0.04)',
  dropShadowLight: '0 2px 0 rgba(37, 11, 54, 0.04)',
  dropShadowHeavy: '0 1px 4px 1px rgba(47,40,55,0.08), 0 4px 16px 0 rgba(47,40,55,0.12)',

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
    background: '#2f2936',
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
    familyMono: '"IBM Plex", Monaco, Consolas, "Courier New", monospace',
    lineHeightHeading: '1.15',
    lineHeightBody: '1.4',
  },

  tag,

  charts: {
    colors: CHART_PALETTE[CHART_PALETTE.length - 1],

    // We have an array that maps `number + 1` --> list of `number` colors
    getColorPalette: (length: number) =>
      CHART_PALETTE[Math.min(CHART_PALETTE.length - 1, length + 1)],

    previousPeriod: colors.gray200,
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

  space: [0, 8, 16, 20, 30],

  demo: {
    headerSize: '70px',
  },
} as const;

const darkAliases = {
  ...aliases,
  bodyBackground: colors.black,
  headerBackground: colors.gray500,
  background: colors.black,
  backgroundSecondary: colors.gray500,
  border: colors.gray400,
  innerBorder: colors.gray500,
  textColor: colors.white,
  subText: colors.gray200,
  linkColor: colors.blue200,
  linkHoverColor: colors.blue300,
  disabled: colors.gray400,
  active: colors.pink300,
  focus: colors.gray500,
  inactive: colors.gray200,
  error: colors.red300,
  success: colors.green300,
  primaryButtonBorder: colors.purple200,
  primaryButtonBorderActive: colors.purple200,
  secondaryButtonText: colors.purple200,
  secondaryButtonBorder: colors.purple200,
  sidebarGradient: 'linear-gradient(6.01deg, #0A090F -8.44%, #1B0921 85.02%)',
  formPlaceholder: colors.gray400,
  formText: colors.white,
  formInputBorder: colors.gray400,
  rowBackground: colors.gray500,
  chartLineColor: colors.gray500,
  chartLabel: colors.gray400,
  progressBar: colors.purple200,
  progressBackground: colors.gray400,
  badgeBackground: colors.gray400,
  alertBackgroundAlpha: 0.1,
  overlayBackgroundAlpha: 'rgba(18, 9, 23, 0.7)',
} as const;

export const lightTheme = {
  ...commonTheme,
  ...aliases,
  alert: generateAlertTheme(aliases),
  badge: generateBadgeTheme(aliases),
  button: generateButtonTheme(aliases),
} as const;

export const darkTheme = {
  ...commonTheme,
  ...darkAliases,
  alert: generateAlertTheme(darkAliases),
  badge: generateBadgeTheme(darkAliases),
  button: generateButtonTheme(darkAliases),
} as const;

export type Theme = typeof lightTheme | typeof darkTheme;
export type Color = keyof typeof colors;
export type IconSize = keyof typeof iconSizes;
export type Aliases = typeof aliases;

export default commonTheme;

// This should never be used directly (except in storybook)
export {aliases};
