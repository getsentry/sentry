const theme = {
  offWhite: '#FAF9FB',
  whiteDark: '#fbfbfc',

  gray1: '#BDB4C7',
  gray2: '#9585A3',
  gray3: '#645574',
  gray4: '#4A3E56',
  gray5: '#302839',

  blue: '#4674ca',
  blueLight: '#608EE4',
  blueDark: '#2D5BB1',

  green: '#57be8c',
  greenLight: '#71D8A6',
  greenDark: '#3EA573',

  yellow: '#ECD744',
  yellowLightest: '#FFFDF7',
  yellowLight: '#FFF15E',
  yellowDark: '#D3BE2B',

  yellowOrange: '#f9a66d',
  yellowOrangeLight: '#FFC087',
  yellowOrangeDark: '#E08D54',

  orange: '#ec5e44',
  orangeLight: '#FF785E',
  orangeDark: '#D3452B',

  red: '#e03e2f',
  redLight: '#FA5849',
  redDark: '#C72516',

  pink: '#F868BC',
  pinkLight: '#FF82D6',
  pinkDark: '#DF4FA3',

  purple: '#6C5FC7',
  purple2: '#6f617c', // This is from event-details
  purplelightest: '#9F92FA',
  purpleLight: '#8679E1',
  purpleDark: '#5346AE',
  purpleDarkest: '#392C94',

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
      background: '#2D5BB1',
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
      background: '#FDF6F5',
      border: '#E7C0BC',
      textLight: '#92635f',
      textDark: '#5d3e3b',
    },
  },

  grid: 8,

  text: {
    family: '"Rubik", "Avenir Next", sans-serif',
    familyMono: 'Monaco, Consolas, "Courier New", monospace',
    lineHeightHeading: '1.15',
    lineHeightBody: '1.4',
    size: {
      default: '12px',
      small: '14px',
      large: '18px',
    },
  },
};

// Aliases
theme.textColor = theme.gray5;
theme.success = theme.green;
theme.error = theme.red;

theme.alert.info.iconColor = theme.blue;
theme.alert.warning.iconColor = theme.yellowDark;
theme.alert.success.iconColor = theme.greenDark;
theme.alert.error.iconColor = theme.redDark;

//alias warn to warning
theme.alert.warn = theme.alert.warning;

export default theme;
