import color from 'color';

import CHART_PALETTE from 'app/constants/chartPalette';

const colors = {
  white: '#FFFFFF',

  gray100: '#FAF9FB',
  gray200: '#F2F0F5',
  gray300: '#E7E1EC',
  gray400: '#C6BECF',
  gray500: '#9585A3',
  gray600: '#645574',
  gray700: '#4A3E56',
  gray800: '#302839',

  yellow100: '#FFFDF5',
  yellow200: '#FFF8C4',
  yellow300: '#FFF492',
  yellow400: '#FFC227',
  yellow500: '#E2A301',

  purple100: '#FAF5FF',
  purple200: '#E7D3FF',
  purple300: '#B9A2FD',
  purple400: '#6C5FC7',
  purple500: '#3E2C73',

  blue100: '#F5F9FF',
  blue200: '#AFC7EE',
  blue300: '#7199DD',
  blue400: '#3D74DB',
  blue500: '#194591',

  orange100: '#FCF8F7',
  orange200: '#F9C7B9',
  orange300: '#F69C7D',
  orange400: '#FF7738',
  orange500: '#BA4A23',

  red100: '#FFF5F7',
  red200: '#F4B1BB',
  red300: '#EA7282',
  red400: '#FA4747',
  red500: '#AC1025',

  green100: '#F5FFFB',
  green200: '#C0F3DD',
  green300: '#8FE7BF',
  green400: '#4DC771',
  green500: '#1C8952',

  pink100: '#FFF5F9',
  pink200: '#FFCEE4',
  pink300: '#FF99BC',
  pink400: '#E1567C',
  pink500: '#902D4C',

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Old Colors
  red: '#e03e2f',
  redLight: '#FA5849',
  redLightest: '#FDF6F5',
  redDark: '#C72516',

  pink: '#F868BC',
  pinkLight: '#FF82D6',
  pinkDark: '#DF4FA3',

  purple: '#6C5FC7',
  purple2: '#6f617c', // This is from event-details
  purpleLightest: '#9F92FA',
  purpleLight: '#8679E1',
  purpleDark: '#5346AE',
  purpleDarkest: '#392C94',

  borderLighter: '#f9f6fd',
  borderLight: '#E2DBE8',
  borderDark: '#D1CAD8',
  borderRadius: '4px',
  borderRadiusBottom: '0 0 4px 4px',
  borderRadiusTop: '4px 4px 0 0',
  headerSelectorRowHeight: 44,
  headerSelectorLabelHeight: 28,

  dropShadowLightest: '0 1px 2px rgba(0, 0, 0, 0.04)',
  dropShadowLight: '0 2px 0 rgba(37, 11, 54, 0.04)',
  dropShadowHeavy: '0 1px 4px 1px rgba(47,40,55,0.08), 0 4px 16px 0 rgba(47,40,55,0.12)',

  background: '#fff',
  placeholderBackground: '#f5f5f5',
} as const;

const warning = {
  background: colors.yellow500,
  backgroundLight: colors.yellow100,
  border: colors.yellow400,
  iconColor: colors.yellow500,
} as const;

const alert = {
  muted: {
    background: colors.gray400,
    backgroundLight: colors.gray100,
    border: colors.gray400,
    iconColor: 'inherit',
  },
  info: {
    background: colors.blue400,
    backgroundLight: colors.blue100,
    border: colors.blue200,
    iconColor: colors.blue400,
  },
  warning,
  warn: warning,
  success: {
    background: colors.green400,
    backgroundLight: colors.green100,
    border: colors.green300,
    iconColor: colors.green500,
  },
  error: {
    background: colors.red400,
    backgroundLight: colors.red100,
    border: colors.red200,
    iconColor: colors.red400,
    textLight: colors.red200,
  },
} as const;

const badge = {
  alpha: {
    background: `linear-gradient(90deg, ${colors.orange300}, ${colors.orange500})`,
    indicatorColor: colors.orange400,
  },
  beta: {
    background: `linear-gradient(90deg, ${colors.pink}, ${colors.purple})`,
    indicatorColor: colors.purple,
  },
  new: {
    background: `linear-gradient(90deg, ${colors.green400}, ${colors.green500})`,
    indicatorColor: colors.green400,
  },
};

const aliases = {
  textColor: colors.gray800,
  success: colors.green400,
  error: colors.red,
  disabled: colors.gray400,
} as const;

const button = {
  borderRadius: '3px',

  default: {
    color: '#2f2936',
    colorActive: '#161319',
    background: colors.white,
    backgroundActive: colors.white,
    border: '#d8d2de',
    borderActive: '#c9c0d1',
    focusShadow: color(colors.borderLight)
      .alpha(0.5)
      .string(),
  },
  primary: {
    color: colors.white,
    colorActive: colors.white,
    background: colors.purple,
    backgroundActive: '#4e3fb4',
    border: '#3d328e',
    borderActive: '#352b7b',
    focusShadow: color(colors.purple)
      .alpha(0.4)
      .string(),
  },
  success: {
    color: colors.white,
    colorActive: colors.white,
    background: '#3fa372',
    backgroundActive: colors.green400,
    border: '#7ccca5',
    borderActive: '#7ccca5',
    focusShadow: color(colors.green400)
      .alpha(0.5)
      .string(),
  },
  danger: {
    color: colors.white,
    colorActive: colors.white,
    background: colors.red,
    backgroundActive: '#bf2a1d',
    border: '#bf2a1d',
    borderActive: '#7d1c13',
    focusShadow: color(colors.red)
      .alpha(0.5)
      .string(),
  },
  link: {
    color: colors.blue400,
    colorActive: colors.blue400,
    background: 'transparent',
    border: false,
    borderActive: false,
    backgroundActive: 'transparent',
    focusShadow: false,
  },
  disabled: {
    color: aliases.disabled,
    colorActive: aliases.disabled,
    border: '#e3e5e6',
    borderActive: '#e3e5e6',
    background: colors.white,
    backgroundActive: colors.white,
    focusShadow: false,
  },
} as const;

const iconSizes = {
  xs: '12px',
  sm: '16px',
  md: '20px',
  lg: '24px',
  xl: '32px',
};

const theme = {
  breakpoints: ['768px', '992px', '1200px', '1440px', '2560px'],

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
    breadcrumbs: {
      header: 2,
      gridCellError: 1,
      iconWrapper: 1,
    },
    traceView: {
      spanTreeToggler: 900,
      rowInfoMessage: 900,
      dividerLine: 909,
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
    headerHeight: '115px',
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
    familyMono: 'Monaco, Consolas, "Courier New", monospace',
    lineHeightHeading: '1.15',
    lineHeightBody: '1.4',
  },

  // Aliases
  ...aliases,

  alert,
  badge,
  button,

  charts: {
    colors: CHART_PALETTE[CHART_PALETTE.length - 1],

    // We have an array that maps `number + 1` --> list of `number` colors
    getColorPalette: (length: number) =>
      CHART_PALETTE[Math.min(CHART_PALETTE.length - 1, length + 1)],

    previousPeriod: colors.gray400,
    symbolSize: 6,
  },

  diff: {
    removedRow: '#fcefee',
    addedRow: '#f5fbf8',
    removed: '#f7ceca',
    added: '#d8f0e4',
  },

  // Similarity spectrum used in "Similar Issues" in group details
  similarity: {
    empty: '#e2dee6',
    colors: ['#ec5e44', '#f38259', '#f9a66d', '#98b480', '#57be8c'],
  },

  space: [0, 8, 16, 20, 30],
} as const;

export type Theme = typeof theme;
export type Color = keyof typeof colors;
export type IconSize = keyof typeof iconSizes;

export default theme;
