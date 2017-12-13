const theme = {
  offWhite: '#FAF9FB',

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
  purplelightest: '#9F92FA',
  purpleLight: '#8679E1',
  purpleDark: '#5346AE',
  purpleDarkest: '#392C94',

  borderLight: '#E2DBE8',
  borderDark: '#D1CAD8',
  borderRadius: '4px',

  dropShadowLight: '0 2px 0 rgba(37, 11, 54, 0.04)',
  dropShadowHeavy: '0 1px 4px 1px rgba(47,40,55,0.08), 0 4px 16px 0 rgba(47,40,55,0.12)',

  alert: {
    info: {
      background: '#F5FAFE',
      border: '#B5D6ED',
    },
    warning: {
      background: '#FFFDF7',
      border: '#E1D697',
    },
    success: {
      background: '#F8FCF7',
      border: '#BBD6B3',
    },
    error: {
      background: '#FDF6F5',
      border: '#E7C0BC',
      textLight: '#92635f',
      textDark: '#5d3e3b',
    },
  },

  text: {
    family: '"Rubik", "Avenir Next", sans-serif',
    familyMono: 'Monaco, monospace',
    lineHeightHeading: '1.15',
    lineHeightBody: '1.4',
    size: {
      default: '12px',
      small: '14px',
      large: '18px',
    },
  },
};

theme.textColor = theme.gray5;

export default theme;
