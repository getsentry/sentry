import type {SentryTheme} from './theme';

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
  }
};

const chonkDarkColors = {
  static: {
    black: '#181225',
    white: '#FFFFFF',
  }
};


const chunk: {
    dark: {
      static: {
        blurple: {
          400: '#7553FF'
          300: '#694BE5'
          200: '#5E42CC'
          100: '#463299'
        }
        green: {
          400: '#00F261'
          300: '#00E55C'
          200: '#7553FF'
          100: '#00D957'
        }
        gold: {
          400: '#FFD00E'
          300: '#FDB81B'
          200: '#E5BB0D'
          100: '#E07518'
        }
        red: {
          400: '#E50045'
          300: '#E565A9'
          200: '#CC5A97'
          100: '#B24E84'
        }
        pink: {
          400: '#FF70BC'
          300: '#7553FF'
          200: '#7553FF'
          100: '#7553FF'
        }
      }
      dynamic: {
        surface: {
          400: '#2F2847'
          300: '#29233D'
          200: '#221E33'
          100: '#0A0910'
        }
        gray: {
          opaque: {
            500: '#FFFFFF'
            400: '#9D9AA7'
            300: '#787283'
            200: '#453F59'
            100: '#3C3552'
          }
          transparent: {
            500: 'rgba(255, 255, 255, 1.0)'
            400: 'rgba(255, 255, 255, 0.56)'
            300: 'rgba(255, 255, 255, 0.36)'
            200: 'rgba(255, 255, 255, 0.13)'
            100: 'rgba(255, 255, 255, 0.09)'
          }
        }
        blurple: {
          400: '#A791FF'
          300: '#B7A6FF'
          200: '#C6B8FF'
          100: '#0A0910'
        }
        green: {
          400: '#55F294'
          300: '#6DF2A2'
          200: '#85F2B1'
          100: '#17753D'
        }
        gold: {
          400: '#FFE166'
          300: '#FFE680'
          200: '#FFEB99'
          100: '#0C0909'
        }
        red: {
          400: '#FF759F'
          300: '#FF8FB0'
          200: '#FFA8C2'
          100: '#150A0D'
        }
        pink: {
          400: 'TBD'
          300: 'TBD'
          200: 'TBD'
          100: 'TBD'
        }
      }
    }
  }
  token: {
    static: {
      text: {
        primary: colorScheme.[value].dynamic.gray.transparent.500
        secondary: colorScheme.[value].dynamic.gray.transparent.400
        accent: colorScheme.[value].dynamic.blurple.400
        success: colorScheme.[value].dynamic.green.400
        warning: colorScheme.[value].dynamic.gold.400
        danger: colorScheme.[value].dynamic.red.400
      }
      graphic: {
        icon: {
          primary: colorScheme.[value].dynamic.gray.transparent.500
          secondary: colorScheme.[value].dynamic.gray.transparent.400
          tertiary: colorScheme.[value].dynamic.gray.transparent.300
          quaternary: colorScheme.[value].dynamic.gray.transparent.200
          accent: colorScheme.[value].static.blurple.400
          success: colorScheme.[value].static.green.100
          warning: colorScheme.[value].static.gold.100
          danger: colorScheme.[value].static.red.400
        }
        chart: {
          annotation: {
            axisLabel: colorScheme.[value].gray.opaque.400
          }
          canvas: {
            lineGrid: colorScheme.[value].gray.opaque.100
          }
        }
      }
      background: {
        primary: colorScheme.[value].dynamic.surface.400
        secondary: colorScheme.[value].dynamic.surface.300
        tertiary: colorScheme.[value].dynamic.surface.200
      }
      border: {
        primary: colorScheme.[value].dynamic.gray.surface.100
        secondary: colorScheme.[value].dynamic.gray.surface.200
      }
    }
    interactive: {
      outline: {
          default: {
            color: colorScheme.[value].static.blurple.400
          }
          danger: {
            color: colorScheme.[value].static.red.400
          }
      }
      link: {
        accent: {
          color: {
            default: colorScheme.[value].dynamic.blurple.400
            hover: colorScheme.[value].dynamic.blurple.400
            active: colorScheme.[value].dynamic.blurple.400
          }
        }
      }
      button: {
        default: {
          chonk: colorScheme.[value].dynamic.surface.100
          children: colorScheme.[value].dynamic.gray.transparent.500
          background: {
            default: colorScheme.[value].dynamic.surface.400
            hover: colorScheme.[value].dynamic.surface.300
            active: colorScheme.[value].dynamic.surface.200
          }
        }
        transparent: {
          chonk: colorScheme.[value].dynamic.surface.100
          children: colorScheme.[value].dynamic.gray.transparent.500
          background: {
            default: colorScheme.[value].dynamic.surface.400
            hover: colorScheme.[value].dynamic.surface.300
            active: colorScheme.[value].dynamic.surface.200
          }
        }
        accent: {
          chonk: colorScheme.[value].dynamic.blurple.100
          children: colorScheme.[value].static.white
          background: {
            default: colorScheme.[value].static.blurple.400
            hover: colorScheme.[value].static.blurple.300
            active: colorScheme.[value].static.blurple.200
          }
        }
        warning: {
          chonk: colorScheme.[value].dynamic.gold.100
          children: colorScheme.[value].static.black
          background: {
            default: colorScheme.[value].static.gold.400
            hover: colorScheme.[value].static.gold.300
            active: colorScheme.[value].static.gold.200
          }
        }
        danger: {
          chonk: colorScheme.[value].dynamic.red.100
          children: colorScheme.[value].static.white
          background: {
            default: colorScheme.[value].static.red.400
            hover: colorScheme.[value].static.red.300
            active: colorScheme.[value].static.red.200
          }
        }
      }
    }
}

export const chonkLightTheme: SentryTheme = {
  isChonk: true,
};

export const chonkDarkTheme: SentryTheme = {
  isChonk: true,
};
