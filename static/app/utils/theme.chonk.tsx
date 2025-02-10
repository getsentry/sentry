import type {SentryTheme} from './theme/theme';

const chonkShared = {
  space: {
    // @TODO(jonasbadalic): none doesn't need to exist
    // none: 0,
    subMicroscoptic: 1,
    microscoptic: 2,
    mini: 4,
    small: 6,
    medium: 8,
    large: 12,
    huge: 16,
  },
  borderRadius: {
    // @TODO(jonasbadalic): none doesn't need to exist
    // none: 0,
    subMicroscoptic: 1,
    microscoptic: 2,
    mini: 3,
    small: 4,
    medium: 5,
    large: 6,
  },
};

const chonkLightColors = {
  // @TODO(jonasbadalic): add explanation about static and dynamic color differences and intended usage
  static: {
    black: '#181225',
    white: '#FFFFFF',

    blurple100: '#463299',
    blurple200: '#5E42CC',
    blurple300: '#694BE5',
    blurple400: '#7553FF',

    green400: '#00F261',
    green300: '#00E55C',
    green200: '#7553FF',
    green100: '#00D957',

    gold400: '#FFD00E',
    gold300: '#FDB81B',
    gold200: '#E5BB0D',
    gold100: '#E07518',

    red400: '#E50045',
    red300: '#E565A9',
    red200: '#CC5A97',
    red100: '#B24E84',

    pink400: '#FF70BC',
    // @TODO(jonasbadalic): duplicates?
    pink300: '#7553FF',
    pink200: '#7553FF',
    pink100: '#7553FF',
  },

  dynamic: {
    // @TODO(jonasbadalic): duplicates?
    surface400: '#FAFAFC',
    surface300: '#FAFAFC',
    surface200: '#F6F5FA',
    surface100: '#DEDCE5',

    // @TODO(jonasbadalic): Why does gray opaque have 500?
    grayOpaque500: '#181225',
    grayOpaque400: '#6D6A76',
    grayOpaque300: '#919098',
    grayOpaque200: '#EAEAEB',
    grayOpaque100: '#F3F3F4',

    grayTransparent500: 'rgba(24, 18, 37, 1.0)',
    grayTransparent400: 'rgba(24, 18, 37, 0.63)',
    grayTransparent300: 'rgba(24, 18, 37, 0.47)',
    grayTransparent200: 'rgba(24, 18, 37, 0.09)',
    grayTransparent100: 'rgba(24, 18, 37, 0.05)',

    blurple400: '#694BE5',
    blurple300: '#5E42CC',
    blurple200: '#523AB2',
    blurple100: '#463299',

    green400: '#17753D',
    green300: '#146635',
    green200: '#115A2E',
    green100: '#00A341',

    gold400: '#9D5710',
    gold300: '#8A4D0F',
    gold200: '#7B450F',
    gold100: '#E07518',

    // @TODO(jonasbadalic): duplicates?
    red400: '#CC003D',
    red300: '#CC003D',
    red200: '#99002E',
    red100: '#800026',

    // @TODO(jonasbadalic): TBD
    pink400: '#FFF',
    pink300: '#FFF',
    pink200: '#FFF',
    pink100: '#FFF',
  },
};

const chonkDarkColors: typeof chonkLightColors = {
  static: {
    black: '#181225',
    white: '#FFFFFF',

    blurple400: '#7553FF',
    blurple300: '#694BE5',
    blurple200: '#5E42CC',
    blurple100: '#463299',

    green400: '#00F261',
    green300: '#00E55C',
    green200: '#7553FF',
    green100: '#00D957',

    gold400: '#FFD00E',
    gold300: '#FDB81B',
    gold200: '#E5BB0D',
    gold100: '#E07518',

    red400: '#E50045',
    red300: '#E565A9',
    red200: '#CC5A97',
    red100: '#B24E84',

    pink400: '#FF70BC',
    // @TODO(jonasbadalic): duplicates?
    pink300: '#7553FF',
    pink200: '#7553FF',
    pink100: '#7553FF',
  },

  dynamic: {
    surface400: '#2F2847',
    surface300: '#29233D',
    surface200: '#221E33',
    surface100: '#0A0910',

    // @TODO(jonasbadalic): why 500 range?
    grayOpaque500: '#FFFFFF',
    grayOpaque400: '#9D9AA7',
    grayOpaque300: '#787283',
    grayOpaque200: '#453F59',
    grayOpaque100: '#3C3552',

    // @TODO(jonasbadalic): why 500 range?
    grayTransparent500: 'rgba(255, 255, 255, 1.0)',
    grayTransparent400: 'rgba(255, 255, 255, 0.56)',
    grayTransparent300: 'rgba(255, 255, 255, 0.36)',
    grayTransparent200: 'rgba(255, 255, 255, 0.13)',
    grayTransparent100: 'rgba(255, 255, 255, 0.09)',

    blurple400: '#A791FF',
    blurple300: '#B7A6FF',
    blurple200: '#C6B8FF',
    blurple100: '#0A0910',

    green400: '#55F294',
    green300: '#6DF2A2',
    green200: '#85F2B1',
    green100: '#17753D',

    gold400: '#FFE166',
    gold300: '#FFE680',
    gold200: '#FFEB99',
    gold100: '#0C0909',

    red400: '#FF759F',
    red300: '#FF8FB0',
    red200: '#FFA8C2',
    red100: '#150A0D',

    // @TODO(jonasbadalic): TBD
    pink400: '#FFF',
    pink300: '#FFF',
    pink200: '#FFF',
    pink100: '#FFF',
  },
};
