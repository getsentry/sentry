import color from 'color';

import CHART_PALETTE from 'app/constants/chartPalette';

const colors = {
  // Colors
  offWhite: '#FAF9FB',
  offWhiteLight: '#F2F0F5',
  offWhite2: '#E7E1EC',

  white: '#FFFFFF',
  whiteDark: '#fbfbfc',
  foreground: '#493E54',

  gray1: '#BDB4C7',
  gray2: '#9585A3',
  gray3: '#645574',
  gray4: '#4A3E56',
  gray5: '#302839',
  gray6: '#AFA3BB', // form disabled

  blue: '#3B6ECC',
  blueLight: '#628BD6',
  blueLightest: '#F5FAFE',
  blueDark: '#2F58A3',

  green: '#57be8c',
  greenLight: '#71D8A6',
  greenLightest: '#f8fcf7',
  greenDark: '#3EA573',
  greenTransparent: 'rgba(87, 190, 140, 0.5)',

  yellow: '#ecc844',
  yellowLightest: '#FFFDF7',
  yellowLight: '#FFF15E',
  yellowDark: '#e6bc23',
  yellowDarkest: '#ecbb08',

  yellowOrange: '#f9a66d',
  yellowOrangeLight: '#FFC087',
  yellowOrangeDark: '#E08D54',

  orange: '#ec5e44',
  orangeLight: '#FF785E',
  orangeDark: '#D3452B',

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
  headerSelectorRowHeight: 44,
  headerSelectorLabelHeight: 28,

  dropShadowLightest: '0 1px 2px rgba(0, 0, 0, 0.04)',
  dropShadowLight: '0 2px 0 rgba(37, 11, 54, 0.04)',
  dropShadowHeavy: '0 1px 4px 1px rgba(47,40,55,0.08), 0 4px 16px 0 rgba(47,40,55,0.12)',

  background: '#fff',
  placeholderBackground: '#f5f5f5',
};

const warning = {
  backgroundLight: colors.yellowLightest,
  background: colors.yellowDarkest,
  border: colors.yellowDark,
  iconColor: colors.yellowDark,
};

const alert = {
  muted: {
    backgroundLight: colors.offWhite,
    background: colors.gray1,
    iconColor: 'inherit',
    border: colors.gray6,
  },
  info: {
    backgroundLight: colors.blueLightest,
    border: colors.blueLight,
    iconColor: colors.blue,
    background: colors.blue,
  },
  warning,
  //alias warn to warning
  warn: warning,
  success: {
    backgroundLight: colors.greenLightest,
    border: colors.green,
    iconColor: colors.greenDark,
    background: colors.green,
  },
  error: {
    backgroundLight: colors.redLightest,
    border: colors.redLight,
    textLight: colors.redLight,
    iconColor: colors.red,
    background: colors.red,
  },
  beta: {
    background: `linear-gradient(90deg, ${colors.pink}, ${colors.purple})`,
  },
};

const aliases = {
  textColor: colors.gray5,
  success: colors.green,
  error: colors.red,
  disabled: colors.gray1,
};

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
    background: '#3fa372',
    backgroundActive: colors.green,
    border: '#7ccca5',
    borderActive: '#7ccca5',
    focusShadow: color(colors.green)
      .alpha(0.5)
      .string(),
  },
  danger: {
    color: colors.white,
    background: colors.red,
    backgroundActive: '#bf2a1d',
    border: '#bf2a1d',
    borderActive: '#7d1c13',
    focusShadow: color(colors.red)
      .alpha(0.5)
      .string(),
  },
  link: {
    color: colors.blue,
    background: 'transparent',
    // border: '#3d328e',
    backgroundActive: 'transparent',
    // borderActive: '#352b7b',
  },
  disabled: {
    color: aliases.disabled,
    border: '#e3e5e6',
    borderActive: '#e3e5e6',
    background: colors.white,
    backgroundActive: colors.white,
  },
};

const theme = {
  breakpoints: ['768px', '992px', '1200px', '1440px', '2560px'],

  ...colors,

  iconSizes: {
    xs: '12px',
    sm: '16px',
    md: '20px',
    lg: '24px',
    xl: '32px',
  },

  iconDirections: {
    up: '0',
    right: '90',
    down: '180',
    left: '270',
  },

  // Try to keep these ordered plz
  zIndex: {
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
    sidebar: 1010,
    orgAndUserMenu: 1011,

    // Sentry user feedback modal
    sentryErrorEmbed: 1090,

    // If you change modal also update shared-components.less
    // as the z-index for bootstrap modals lives there.
    modal: 10000,
    toast: 10001,

    // tooltips and hovercards can be inside modals sometimes.
    tooltip: 10002,
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
    panel: {
      width: '320px',
      headerHeight: '62px',
    },
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
  button,

  charts: {
    colors: CHART_PALETTE[CHART_PALETTE.length - 1],

    // We have an array that maps `number + 1` --> list of `number` colors
    getColorPalette: (length: number) =>
      CHART_PALETTE[Math.min(CHART_PALETTE.length - 1, length + 1)],

    previousPeriod: colors.gray1,
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

export default theme;
