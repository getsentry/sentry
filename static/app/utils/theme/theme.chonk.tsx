import type {SentryTheme} from 'sentry/utils/theme';

function _generateChonkTokens(colorScheme: typeof _chonkLightColors) {
  return {
    token: {
      static: {
        text: {
          primary: colorScheme.dynamic.grayTransparent500,
          secondary: colorScheme.dynamic.grayTransparent400,
          accent: colorScheme.dynamic.blurple400,
          success: colorScheme.dynamic.green400,
          warning: colorScheme.dynamic.gold400,
          danger: colorScheme.dynamic.red400,
        },
        graphic: {
          icon: {
            primary: colorScheme.dynamic.grayTransparent500,
            secondary: colorScheme.dynamic.grayTransparent400,
            tertiary: colorScheme.dynamic.grayTransparent300,
            quaternary: colorScheme.dynamic.grayTransparent200,
            accent: colorScheme.static.blurple400,
            success: colorScheme.static.green100,
            warning: colorScheme.static.gold100,
            danger: colorScheme.static.red400,
          },
          chart: {
            annotation: {
              axisLabel: colorScheme.dynamic.grayOpaque400,
            },
            canvas: {
              lineGrid: colorScheme.dynamic.grayOpaque100,
            },
          },
        },
        background: {
          primary: colorScheme.dynamic.surface400,
          secondary: colorScheme.dynamic.surface300,
          tertiary: colorScheme.dynamic.surface200,
        },
        border: {
          primary: colorScheme.dynamic.surface100,
          secondary: colorScheme.dynamic.surface200,
        },
      },
      interactive: {
        outline: {
          default: {
            color: colorScheme.static.blurple400,
          },
          danger: {
            color: colorScheme.static.red400,
          },
        },
        link: {
          accent: {
            color: {
              default: colorScheme.dynamic.blurple400,
              hover: colorScheme.dynamic.blurple400,
              active: colorScheme.dynamic.blurple400,
            },
          },
        },
        button: {
          default: {
            chonk: colorScheme.dynamic.surface100,
            children: colorScheme.dynamic.grayTransparent500,
            background: {
              default: colorScheme.dynamic.surface400,
              hover: colorScheme.dynamic.surface300,
              active: colorScheme.dynamic.surface200,
            },
          },
          transparent: {
            chonk: colorScheme.dynamic.surface100,
            children: colorScheme.dynamic.grayTransparent500,
            background: {
              default: colorScheme.dynamic.surface400,
              hover: colorScheme.dynamic.surface300,
              active: colorScheme.dynamic.surface200,
            },
          },
          accent: {
            chonk: colorScheme.dynamic.blurple100,
            children: colorScheme.static.white,
            background: {
              default: colorScheme.static.blurple400,
              hover: colorScheme.static.blurple300,
              active: colorScheme.static.blurple200,
            },
          },
          warning: {
            chonk: colorScheme.dynamic.gold100,
            children: colorScheme.static.black,
            background: {
              default: colorScheme.static.gold400,
              hover: colorScheme.static.gold300,
              active: colorScheme.static.gold200,
            },
          },
          danger: {
            chonk: colorScheme.dynamic.red100,
            children: colorScheme.static.white,
            background: {
              default: colorScheme.static.red400,
              hover: colorScheme.static.red300,
              active: colorScheme.static.red200,
            },
          },
        },
      },
    },
  };
}

const _chonkShared = {
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

const lightColors = {
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

const darkColors: typeof lightColors = {
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

const _chonkLightTheme: SentryTheme = {
  black: lightColors.static.black,
  white: lightColors.static.white,

  // @TODO(jonasbadalic): why is this needed?
  lightModeBlack: lightColors.static.black,
  lightModeWhite: lightColors.static.white,

  surface100: lightColors.dynamic.surface100,
  surface200: lightColors.dynamic.surface200,
  surface300: lightColors.dynamic.surface300,
  surface400: lightColors.dynamic.surface400,

  translucentSurface100: lightColors.dynamic.surface100,
  translucentSurface200: lightColors.dynamic.surface200,

  surface500: lightColors.dynamic.surface300,

  gray500: lightColors.dynamic.grayOpaque500,
  gray400: lightColors.dynamic.grayOpaque400,
  gray300: lightColors.dynamic.grayOpaque300,
  gray200: lightColors.dynamic.grayOpaque200,
  gray100: lightColors.dynamic.grayOpaque100,

  translucentGray200: lightColors.dynamic.grayTransparent200,
  translucentGray100: lightColors.dynamic.grayTransparent100,

  purple400: lightColors.dynamic.blurple400,
  purple300: lightColors.dynamic.blurple300,
  purple200: lightColors.dynamic.blurple200,
  purple100: lightColors.dynamic.blurple100,

  blue400: lightColors.dynamic.blurple400,
  blue300: lightColors.dynamic.blurple300,
  blue200: lightColors.dynamic.blurple200,
  blue100: lightColors.dynamic.blurple100,

  green400: lightColors.dynamic.green400,
  green300: lightColors.dynamic.green300,
  green200: lightColors.dynamic.green200,
  green100: lightColors.dynamic.green100,

  yellow400: lightColors.dynamic.gold400,
  yellow300: lightColors.dynamic.gold300,
  yellow200: lightColors.dynamic.gold200,
  yellow100: lightColors.dynamic.gold100,

  red400: lightColors.dynamic.red400,
  red300: lightColors.dynamic.red300,
  red200: lightColors.dynamic.red200,
  red100: lightColors.dynamic.red100,

  pink400: lightColors.dynamic.pink400,
  pink300: lightColors.dynamic.pink300,
  pink200: lightColors.dynamic.pink200,
  pink100: lightColors.dynamic.pink100,
};
