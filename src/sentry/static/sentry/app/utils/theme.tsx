import color from 'color';

import CHART_PALETTE from 'app/constants/chartPalette';

const colors = {
  white: '#FFFFFF',
  black: '#1D1127',

  gray100: '#FAF9FB',
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
  blue200: '#92A8EA',
  blue300: '#3D74DB',

  red100: '#FCC6C8',
  red200: '#FD918F',
  red300: '#F55459',

  green100: '#B6ECDF',
  green200: '#7DD6BE',
  green300: '#33BF9E',

  pink100: '#FDC9D7',
  pink200: '#FA93AB',
  pink300: '#F05781',

  borderRadius: '4px',
  borderRadiusBottom: '0 0 4px 4px',
  borderRadiusTop: '4px 4px 0 0',
  headerSelectorRowHeight: 44,
  headerSelectorLabelHeight: 28,

  dropShadowLightest: '0 1px 2px rgba(0, 0, 0, 0.04)',
  dropShadowLight: '0 2px 0 rgba(37, 11, 54, 0.04)',
  dropShadowHeavy: '0 1px 4px 1px rgba(47,40,55,0.08), 0 4px 16px 0 rgba(47,40,55,0.12)',
};

const aliases = {
  textColor: colors.gray500,
  subText: colors.gray400,
  success: colors.green300,
  error: colors.red300,
  border: colors.gray200,
  disabled: colors.gray200,
  headerBackground: colors.white,
  bodyBackground: colors.gray100,
  background: colors.white,
  backgroundAccent: colors.gray100,
  active: colors.pink300,
  linkColor: colors.purple300,
  secondaryButton: colors.purple300,
  sidebarGradient:
    'linear-gradient(294.17deg,#2f1937 35.57%,#452650 92.42%,#452650 92.42%)',
  formPlaceholder: colors.gray200,
  formText: colors.gray500,
  rowBackground: colors.gray100,
  chartLineColor: colors.gray200,
  chartLabel: colors.gray300,
};

const warning = {
  background: colors.yellow100,
  backgroundLight: colors.yellow100,
  border: colors.yellow300,
  iconColor: colors.yellow300,
} as const;

const alert = {
  muted: {
    background: colors.gray200,
    backgroundLight: aliases.backgroundAccent,
    border: aliases.border,
    iconColor: 'inherit',
  },
  info: {
    background: colors.blue100,
    backgroundLight: colors.blue100,
    border: colors.blue300,
    iconColor: colors.blue300,
  },
  warning,
  warn: warning,
  success: {
    background: colors.green100,
    backgroundLight: colors.green100,
    border: colors.green300,
    iconColor: colors.green300,
  },
  error: {
    background: colors.red100,
    backgroundLight: colors.red100,
    border: colors.red300,
    iconColor: colors.red300,
    textLight: colors.red200,
  },
};

const badge = {
  alpha: {
    background: `linear-gradient(90deg, ${colors.red200}, ${colors.red300})`,
    indicatorColor: colors.red200,
  },
  beta: {
    background: `linear-gradient(90deg, ${colors.pink300}, ${colors.purple300})`,
    indicatorColor: colors.purple300,
  },
  new: {
    background: `linear-gradient(90deg, ${colors.green300}, ${colors.green300})`,
    indicatorColor: colors.green300,
  },
};

const generateButton = alias => ({
  borderRadius: '3px',

  default: {
    color: alias.secondaryButton,
    colorActive: alias.secondaryButton,
    background: 'transparent',
    backgroundActive: 'transparent',

    border: alias.secondaryButton,
    borderActive: alias.secondaryButton,
    focusShadow: color(colors.gray200).alpha(0.5).string(),
  },
  primary: {
    color: colors.white,
    colorActive: colors.white,
    background: colors.purple300,
    backgroundActive: '#4e3fb4',
    border: colors.purple300,
    borderActive: colors.purple300,
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
    color: alias.linkColor,
    colorActive: alias.linkColor,
    background: 'transparent',
    border: false,
    borderActive: false,
    backgroundActive: 'transparent',
    focusShadow: false,
  },
  disabled: {
    color: alias.disabled,
    colorActive: alias.disabled,
    border: '#e3e5e6',
    borderActive: '#e3e5e6',
    background: colors.white,
    backgroundActive: colors.white,
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
    // Generic z-index when you hope your component is isolated and
    // does not need to battle others for z-index priority
    initial: 1,

    breadcrumbs: {
      header: 2,
      gridCellError: 1,
      iconWrapper: 1,
    },
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
    familyMono: 'Monaco, Consolas, "Courier New", monospace',
    lineHeightHeading: '1.15',
    lineHeightBody: '1.4',
  },

  // Aliases
  ...aliases,

  alert,
  badge,
  button: generateButton(aliases),

  charts: {
    colors: CHART_PALETTE[CHART_PALETTE.length - 1],

    // We have an array that maps `number + 1` --> list of `number` colors
    getColorPalette: (length: number) =>
      CHART_PALETTE[Math.min(CHART_PALETTE.length - 1, length + 1)],

    previousPeriod: colors.gray200,
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
};

const darkAliases = {
  bodyBackground: colors.black,
  headerBackground: colors.gray500,
  background: colors.black,
  backgroundAccent: colors.gray500,
  border: colors.gray400,
  textColor: colors.white,
  subText: colors.gray200,
  linkColor: colors.purple200,
  secondaryButton: colors.purple200,
  sidebarGradient: 'linear-gradient(6.01deg, #0A090F -8.44%, #1B0921 85.02%)',
  formText: colors.white,
  rowBackground: colors.gray500,
  chartLineColor: colors.gray400,
  chartLabel: colors.gray400,
};

export const darkTheme = {
  ...theme,
  ...darkAliases,
  button: generateButton(darkAliases),
};

export type Theme = typeof theme | typeof darkTheme;
export type Color = keyof typeof colors;
export type IconSize = keyof typeof iconSizes;

export default theme;
