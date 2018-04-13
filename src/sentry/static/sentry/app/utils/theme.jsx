const theme = {
  offWhite: '#FAF9FB',
  whiteDark: '#fbfbfc',

  gray1: '#BDB4C7',
  gray2: '#9585A3',
  gray3: '#645574',
  gray4: '#4A3E56',
  gray5: '#302839',
  gray6: '#1D1922',

  blue: '#2c60bf',
  blueLight: '#698ed1',
  blueDark: '#2551a2',

  green: '#45bf84',
  greenLight: '#7ad1a7',
  greenDark: '#3aa16f',
  greenTransparent: 'rgba(87, 190, 140, 0.5)',

  yellow: '#eb982d',
  yellowLightest: '#FFFDF7',
  yellowLight: '#f0b569',
  yellowDark: '#c78126',

  yellowOrange: '#eb7738',
  yellowOrangeLight: '#f09e71',
  yellowOrangeDark: '#c7652f',

  orange: '#ed5934',
  orangeLight: '#f2896e',
  orangeDark: '#c94b2c',

  red: '#de3a2b',
  redLight: '#e8675b',
  redDark: '#bd2215',

  pink: '#d94aa2',
  pinkLight: '#e47ebc',
  pinkDark: '#b83e89',

  purple: '#5c4cc7',
  purple2: '#6f617c', // This is from event-details
  purplelightest: '#9f92fa',
  purpleLight: '#8b7fd7',
  purpleDark: '#40358b',
  purpleDarkest: '#392c94',

  borderLighter: '#f9f6fd',
  borderLight: '#E2DBE8',
  borderDark: '#D1CAD8',
  borderRadius: '4px',

  dropShadowLight: '0 2px 0 rgba(37, 11, 54, 0.04)',
  dropShadowHeavy: '0 1px 4px 1px rgba(47,40,55,0.08), 0 4px 16px 0 rgba(47,40,55,0.12)',

  zIndex: {
    sidebar: 100,
    header: 1000,
    dropdown: 1001,
    modal: 10000,
    toast: 10001,
  },

  alert: {
    info: {
      backgroundLight: '#F5FAFE',
      border: '#B5D6ED',
    },
    warning: {
      backgroundLight: '#FFFDF7',
      background: '#f9a66d',
      border: '#E1D697',
      textDark: '#D3BE2B',
    },
    success: {
      backgroundLight: '#F8FCF7',
      background: '#57be8c',
      border: '#BBD6B3',
    },
    error: {
      backgroundLight: '#FDF6F5',
      border: '#E7C0BC',
      textLight: '#92635f',
      textDark: '#5d3e3b',
    },
  },

  grid: 8,
  fontSizeSmall: '12px',
  fontSizeMedium: '16px',
  fontSizeLarge: '18px',

  settings: {
    containerWidth: '1140px',
    headerHeight: '115px',
    sidebarWidth: '210px',
  },

  text: {
    family: '"Rubik", "Avenir Next", sans-serif',
    familyMono: 'Monaco, Consolas, "Courier New", monospace',
    lineHeightHeading: '1.15',
    lineHeightBody: '1.4',
  },
};

// Aliases
theme.textColor = theme.gray5;
theme.success = theme.green;
theme.error = theme.red;

theme.alert.info.iconColor = theme.blue;
theme.alert.info.background = theme.blue;

theme.alert.warning.iconColor = theme.yellowDark;
theme.alert.warning.background = theme.yellow;

theme.alert.success.iconColor = theme.greenDark;
theme.alert.success.background = theme.green;

theme.alert.error.iconColor = theme.redDark;
theme.alert.error.background = theme.red;

//alias warn to warning
theme.alert.warn = theme.alert.warning;

export default theme;
