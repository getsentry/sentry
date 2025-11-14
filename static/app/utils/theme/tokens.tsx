import {color} from './color';

const alias = {
  background: {
    primary: {
      light: color.white,
      dark: color.neutral.dark.opaque[500],
      ash: color.neutral.dark.opaque[600],
      midnight: color.neutral.dark.opaque[400],
    },
    secondary: {
      light: color.neutral.light.opaque[100],
      dark: color.neutral.dark.opaque[400],
      ash: color.neutral.dark.opaque[500],
      midnight: color.neutral.dark.opaque[300],
    },
    tertiary: {
      light: color.neutral.light.opaque[200],
      dark: color.neutral.dark.opaque[300],
      ash: color.neutral.dark.opaque[400],
      midnight: color.neutral.dark.opaque[200],
    },
    overlay: {
      light: color.white,
      dark: color.neutral.dark.opaque[600],
      ash: color.neutral.dark.opaque[700],
      midnight: color.neutral.dark.opaque[500],
    },
    accent: {
      vibrant: {
        light: color.blue.light.opaque[1000],
        dark: color.blue.dark.opaque[900],
        ash: color.blue.dark.opaque[900],
        midnight: color.blue.dark.opaque[900],
      },
    },
    promotion: {
      vibrant: {
        light: color.pink.light.opaque[800],
        dark: color.pink.dark.opaque[1000],
        ash: color.pink.dark.opaque[1000],
        midnight: color.pink.dark.opaque[1000],
      },
    },
    danger: {
      vibrant: {
        light: color.red.light.opaque[1000],
        dark: color.red.dark.opaque[900],
        ash: color.red.dark.opaque[900],
        midnight: color.red.dark.opaque[900],
      },
    },
    warning: {
      vibrant: {
        light: color.yellow.light.opaque[600],
        dark: color.yellow.dark.opaque[1200],
        ash: color.yellow.dark.opaque[1200],
        midnight: color.yellow.dark.opaque[1200],
      },
    },
    success: {
      vibrant: {
        light: color.green.light.opaque[800],
        dark: color.green.dark.opaque[1100],
        ash: color.green.dark.opaque[1100],
        midnight: color.green.dark.opaque[1100],
      },
    },
    transparent: {
      neutral: {
        muted: {
          light: color.neutral.light.transparent[200],
          dark: color.neutral.dark.transparent[200],
          ash: color.neutral.dark.transparent[200],
          midnight: color.neutral.dark.transparent[200],
        },
      },
      accent: {
        muted: {
          light: color.blue.light.transparent[200],
          dark: color.blue.dark.transparent[500],
          ash: color.blue.dark.transparent[500],
          midnight: color.blue.dark.transparent[500],
        },
      },
      promotion: {
        muted: {
          light: color.pink.light.transparent[200],
          dark: color.pink.dark.transparent[200],
          ash: color.pink.dark.transparent[200],
          midnight: color.pink.dark.transparent[200],
        },
      },
      danger: {
        muted: {
          light: color.red.light.transparent[200],
          dark: color.red.dark.transparent[200],
          ash: color.red.dark.transparent[200],
          midnight: color.red.dark.transparent[200],
        },
      },
      warning: {
        muted: {
          light: color.yellow.light.transparent[200],
          dark: color.yellow.dark.transparent[200],
          ash: color.yellow.dark.transparent[200],
          midnight: color.yellow.dark.transparent[200],
        },
      },
      success: {
        muted: {
          light: color.green.light.transparent[200],
          dark: color.green.dark.transparent[200],
          ash: color.green.dark.transparent[200],
          midnight: color.green.dark.transparent[200],
        },
      },
    },
  },
  content: {
    headings: {
      light: color.neutral.light.opaque[1600],
      dark: color.white,
      ash: color.white,
      midnight: color.white,
    },
    primary: {
      light: color.neutral.light.opaque[1500],
      dark: color.neutral.dark.opaque[1500],
      ash: color.neutral.dark.opaque[1500],
      midnight: color.neutral.dark.opaque[1500],
    },
    secondary: {
      light: color.neutral.light.opaque[1100],
      dark: color.neutral.dark.opaque[1200],
      ash: color.neutral.dark.opaque[1300],
      midnight: color.neutral.dark.opaque[1100],
    },
    disabled: {
      light: color.neutral.light.opaque[900],
      dark: color.neutral.dark.opaque[1000],
      ash: color.neutral.dark.opaque[1100],
      midnight: color.neutral.dark.opaque[900],
    },
    accent: {
      light: color.blue.light.opaque[1100],
      dark: color.blue.dark.opaque[1200],
      ash: color.blue.dark.opaque[1300],
      midnight: color.blue.dark.opaque[1100],
    },
    promotion: {
      light: color.pink.light.opaque[1100],
      dark: color.pink.dark.opaque[1200],
      ash: color.pink.dark.opaque[1300],
      midnight: color.pink.dark.opaque[1100],
    },
    danger: {
      light: color.red.light.opaque[1100],
      dark: color.red.dark.opaque[1200],
      ash: color.red.dark.opaque[1300],
      midnight: color.red.dark.opaque[1100],
    },
    warning: {
      light: color.yellow.light.opaque[1100],
      dark: color.yellow.dark.opaque[1200],
      ash: color.yellow.dark.opaque[1300],
      midnight: color.yellow.dark.opaque[1100],
    },
    success: {
      light: color.green.light.opaque[1100],
      dark: color.green.dark.opaque[1200],
      ash: color.green.dark.opaque[1300],
      midnight: color.green.dark.opaque[1100],
    },
    onVibrant: {
      light: {
        light: color.white,
        dark: color.white,
        ash: color.white,
        midnight: color.white,
      },
      dark: {
        light: color.black,
        dark: color.black,
        ash: color.black,
        midnight: color.black,
      },
    },
  },
  graphics: {
    neutral: {
      muted: {
        light: color.neutral.light.opaque[400],
        dark: color.neutral.dark.opaque[800],
        ash: color.neutral.dark.opaque[800],
        midnight: color.neutral.dark.opaque[800],
      },
      moderate: {
        light: color.neutral.light.opaque[600],
        dark: color.neutral.dark.opaque[900],
        ash: color.neutral.dark.opaque[900],
        midnight: color.neutral.dark.opaque[900],
      },
      vibrant: {
        light: color.neutral.light.opaque[800],
        dark: color.neutral.dark.opaque[1200],
        ash: color.neutral.dark.opaque[1200],
        midnight: color.neutral.dark.opaque[1200],
      },
    },
    accent: {
      muted: {
        light: color.blue.light.opaque[400],
        dark: color.blue.dark.opaque[800],
        ash: color.blue.dark.opaque[800],
        midnight: color.blue.dark.opaque[800],
      },
      moderate: {
        light: color.blue.light.opaque[600],
        dark: color.blue.dark.opaque[900],
        ash: color.blue.dark.opaque[900],
        midnight: color.blue.dark.opaque[900],
      },
      vibrant: {
        light: color.blue.light.opaque[1000],
        dark: color.blue.dark.opaque[900],
        ash: color.blue.dark.opaque[900],
        midnight: color.blue.dark.opaque[900],
      },
    },
    promotion: {
      muted: {
        light: color.pink.light.opaque[400],
        dark: color.pink.dark.opaque[800],
        ash: color.pink.dark.opaque[800],
        midnight: color.pink.dark.opaque[800],
      },
      moderate: {
        light: color.pink.light.opaque[600],
        dark: color.pink.dark.opaque[900],
        ash: color.pink.dark.opaque[900],
        midnight: color.pink.dark.opaque[900],
      },
      vibrant: {
        light: color.pink.light.opaque[700],
        dark: color.pink.dark.opaque[1000],
        ash: color.pink.dark.opaque[1000],
        midnight: color.pink.dark.opaque[1000],
      },
    },
    danger: {
      muted: {
        light: color.red.light.opaque[400],
        dark: color.red.dark.opaque[800],
        ash: color.red.dark.opaque[800],
        midnight: color.red.dark.opaque[800],
      },
      moderate: {
        light: color.red.light.opaque[600],
        dark: color.red.dark.opaque[900],
        ash: color.red.dark.opaque[900],
        midnight: color.red.dark.opaque[900],
      },
      vibrant: {
        light: color.red.light.opaque[1000],
        dark: color.red.dark.opaque[900],
        ash: color.red.dark.opaque[900],
        midnight: color.red.dark.opaque[900],
      },
    },
    warning: {
      muted: {
        light: color.yellow.light.opaque[400],
        dark: color.yellow.dark.opaque[900],
        ash: color.yellow.dark.opaque[900],
        midnight: color.yellow.dark.opaque[900],
      },
      moderate: {
        light: color.yellow.light.opaque[500],
        dark: color.yellow.dark.opaque[1100],
        ash: color.yellow.dark.opaque[1100],
        midnight: color.yellow.dark.opaque[1100],
      },
      vibrant: {
        light: color.yellow.light.opaque[600],
        dark: color.yellow.dark.opaque[1200],
        ash: color.yellow.dark.opaque[1200],
        midnight: color.yellow.dark.opaque[1200],
      },
    },
    success: {
      muted: {
        light: color.green.light.opaque[400],
        dark: color.green.dark.opaque[800],
        ash: color.green.dark.opaque[800],
        midnight: color.green.dark.opaque[800],
      },
      moderate: {
        light: color.green.light.opaque[600],
        dark: color.green.dark.opaque[900],
        ash: color.green.dark.opaque[900],
        midnight: color.green.dark.opaque[900],
      },
      vibrant: {
        light: color.green.light.opaque[800],
        dark: color.green.dark.opaque[1100],
        ash: color.green.dark.opaque[1100],
        midnight: color.green.dark.opaque[1100],
      },
    },
  },
  border: {
    primary: {
      light: color.neutral.light.opaque[400],
      dark: color.neutral.dark.opaque[200],
      ash: color.neutral.dark.opaque[300],
      midnight: color.black,
    },
    secondary: {
      light: color.neutral.light.opaque[300],
      dark: color.neutral.dark.opaque[300],
      ash: color.neutral.dark.opaque[400],
      midnight: color.neutral.dark.opaque[100],
    },
    onVibrant: {
      light: {
        light: color.white,
        dark: color.white,
        ash: color.white,
        midnight: color.white,
      },
      dark: {
        light: color.black,
        dark: color.black,
        ash: color.black,
        midnight: color.black,
      },
    },
    neutral: {
      muted: {
        light: color.neutral.light.opaque[400],
        dark: color.neutral.dark.opaque[800],
        ash: color.neutral.dark.opaque[800],
        midnight: color.neutral.dark.opaque[800],
      },
      moderate: {
        light: color.neutral.light.opaque[600],
        dark: color.neutral.dark.opaque[900],
        ash: color.neutral.dark.opaque[900],
        midnight: color.neutral.dark.opaque[900],
      },
      vibrant: {
        light: color.neutral.light.opaque[800],
        dark: color.neutral.dark.opaque[1200],
        ash: color.neutral.dark.opaque[1200],
        midnight: color.neutral.dark.opaque[1200],
      },
    },
    accent: {
      muted: {
        light: color.blue.light.opaque[400],
        dark: color.blue.dark.opaque[800],
        ash: color.blue.dark.opaque[800],
        midnight: color.blue.dark.opaque[800],
      },
      moderate: {
        light: color.blue.light.opaque[600],
        dark: color.blue.dark.opaque[900],
        ash: color.blue.dark.opaque[900],
        midnight: color.blue.dark.opaque[900],
      },
      vibrant: {
        light: color.blue.light.opaque[1000],
        dark: color.blue.dark.opaque[900],
        ash: color.blue.dark.opaque[900],
        midnight: color.blue.dark.opaque[900],
      },
    },
    promotion: {
      muted: {
        light: color.pink.light.opaque[400],
        dark: color.pink.dark.opaque[800],
        ash: color.pink.dark.opaque[800],
        midnight: color.pink.dark.opaque[800],
      },
      moderate: {
        light: color.pink.light.opaque[600],
        dark: color.pink.dark.opaque[900],
        ash: color.pink.dark.opaque[900],
        midnight: color.pink.dark.opaque[900],
      },
      vibrant: {
        light: color.pink.light.opaque[700],
        dark: color.pink.dark.opaque[1000],
        ash: color.pink.dark.opaque[1000],
        midnight: color.pink.dark.opaque[1000],
      },
    },
    danger: {
      muted: {
        light: color.red.light.opaque[400],
        dark: color.red.dark.opaque[800],
        ash: color.red.dark.opaque[800],
        midnight: color.red.dark.opaque[800],
      },
      moderate: {
        light: color.red.light.opaque[600],
        dark: color.red.dark.opaque[900],
        ash: color.red.dark.opaque[900],
        midnight: color.red.dark.opaque[900],
      },
      vibrant: {
        light: color.red.light.opaque[1000],
        dark: color.red.dark.opaque[900],
        ash: color.red.dark.opaque[900],
        midnight: color.red.dark.opaque[900],
      },
    },
    warning: {
      muted: {
        light: color.yellow.light.opaque[400],
        dark: color.yellow.dark.opaque[900],
        ash: color.yellow.dark.opaque[900],
        midnight: color.yellow.dark.opaque[900],
      },
      moderate: {
        light: color.yellow.light.opaque[500],
        dark: color.yellow.dark.opaque[1100],
        ash: color.yellow.dark.opaque[1100],
        midnight: color.yellow.dark.opaque[1100],
      },
      vibrant: {
        light: color.yellow.light.opaque[600],
        dark: color.yellow.dark.opaque[1200],
        ash: color.yellow.dark.opaque[1200],
        midnight: color.yellow.dark.opaque[1200],
      },
    },
    success: {
      muted: {
        light: color.green.light.opaque[400],
        dark: color.green.dark.opaque[800],
        ash: color.green.dark.opaque[800],
        midnight: color.green.dark.opaque[800],
      },
      moderate: {
        light: color.green.light.opaque[600],
        dark: color.green.dark.opaque[900],
        ash: color.green.dark.opaque[900],
        midnight: color.green.dark.opaque[900],
      },
      vibrant: {
        light: color.green.light.opaque[800],
        dark: color.green.dark.opaque[1100],
        ash: color.green.dark.opaque[1100],
        midnight: color.green.dark.opaque[1100],
      },
    },
    transparent: {
      neutral: {
        muted: {
          light: color.neutral.light.transparent[400],
          dark: color.neutral.dark.transparent[500],
          ash: color.neutral.dark.transparent[500],
          midnight: color.neutral.dark.transparent[500],
        },
        moderate: {
          light: color.neutral.light.transparent[600],
          dark: color.neutral.dark.transparent[900],
          ash: color.neutral.dark.transparent[900],
          midnight: color.neutral.dark.transparent[900],
        },
        vibrant: {
          light: color.neutral.light.transparent[800],
          dark: color.neutral.dark.transparent[900],
          ash: color.neutral.dark.transparent[900],
          midnight: color.neutral.dark.transparent[900],
        },
      },
      accent: {
        muted: {
          light: color.blue.light.transparent[400],
          dark: color.blue.dark.transparent[800],
          ash: color.blue.dark.transparent[800],
          midnight: color.blue.dark.transparent[800],
        },
        moderate: {
          light: color.blue.light.transparent[600],
          dark: color.blue.dark.transparent[900],
          ash: color.blue.dark.transparent[900],
          midnight: color.blue.dark.transparent[900],
        },
        vibrant: {
          light: color.blue.light.transparent[1000],
          dark: color.blue.dark.transparent[900],
          ash: color.blue.dark.transparent[900],
          midnight: color.blue.dark.transparent[900],
        },
      },
      promotion: {
        muted: {
          light: color.pink.light.transparent[400],
          dark: color.pink.dark.transparent[800],
          ash: color.pink.dark.transparent[800],
          midnight: color.pink.dark.transparent[800],
        },
        moderate: {
          light: color.pink.light.transparent[600],
          dark: color.pink.dark.transparent[900],
          ash: color.pink.dark.transparent[900],
          midnight: color.pink.dark.transparent[900],
        },
        vibrant: {
          light: color.pink.light.transparent[700],
          dark: color.pink.dark.transparent[1000],
          ash: color.pink.dark.transparent[1000],
          midnight: color.pink.dark.transparent[1000],
        },
      },
      danger: {
        muted: {
          light: color.red.light.transparent[400],
          dark: color.red.dark.transparent[800],
          ash: color.red.dark.transparent[800],
          midnight: color.red.dark.transparent[800],
        },
        moderate: {
          light: color.red.light.transparent[600],
          dark: color.red.dark.transparent[900],
          ash: color.red.dark.transparent[900],
          midnight: color.red.dark.transparent[900],
        },
        vibrant: {
          light: color.red.light.transparent[1000],
          dark: color.red.dark.transparent[900],
          ash: color.red.dark.transparent[900],
          midnight: color.red.dark.transparent[900],
        },
      },
      warning: {
        muted: {
          light: color.yellow.light.transparent[400],
          dark: color.yellow.dark.transparent[900],
          ash: color.yellow.dark.transparent[900],
          midnight: color.yellow.dark.transparent[900],
        },
        moderate: {
          light: color.yellow.light.transparent[500],
          dark: color.yellow.dark.transparent[1100],
          ash: color.yellow.dark.transparent[1100],
          midnight: color.yellow.dark.transparent[1100],
        },
        vibrant: {
          light: color.yellow.light.transparent[600],
          dark: color.yellow.dark.transparent[1200],
          ash: color.yellow.dark.transparent[1200],
          midnight: color.yellow.dark.transparent[1200],
        },
      },
      success: {
        muted: {
          light: color.green.light.transparent[400],
          dark: color.green.dark.transparent[600],
          ash: color.green.dark.transparent[600],
          midnight: color.green.dark.transparent[600],
        },
        moderate: {
          light: color.green.light.transparent[600],
          dark: color.green.dark.transparent[900],
          ash: color.green.dark.transparent[900],
          midnight: color.green.dark.transparent[900],
        },
        vibrant: {
          light: color.green.light.transparent[800],
          dark: color.green.dark.transparent[1100],
          ash: color.green.dark.transparent[1100],
          midnight: color.green.dark.transparent[1100],
        },
      },
    },
  },
  shadow: {
    low: {
      light: color.neutral.light.transparent[200],
      dark: color.neutral.light.transparent[800],
      ash: color.neutral.light.transparent[800],
      midnight: color.neutral.light.transparent[800],
    },
    medium: {
      light: color.neutral.light.transparent[100],
      dark: color.neutral.light.transparent[300],
      ash: color.neutral.light.transparent[300],
      midnight: color.neutral.light.transparent[300],
    },
  },
};

export const tokens = {
  color: {
    ...alias,
    interactive: {
      // TODO
    },
    syntax: {
      base: alias.content.primary,
      inlineCode: alias.content.primary,
      codeBackground: alias.background.secondary,
      highlightBackround: alias.background.transparent.neutral.muted,
      highlightAccent: {
        light: color.neutral.light.transparent[400],
        dark: color.neutral.dark.transparent[400],
        ash: color.neutral.dark.transparent[400],
        midnight: color.neutral.dark.transparent[400],
      },
      comment: alias.content.secondary,
      punctuation: alias.content.primary,
      property: alias.content.accent,
      selector: alias.content.success,
      operator: alias.content.accent,
      variable: alias.content.primary,
      function: alias.content.accent,
      keyword: alias.content.danger,
    },
    focus: {
      default: alias.border.accent.vibrant,
      vibrant: alias.border.danger.vibrant,
      onVibrant: {
        light: alias.border.onVibrant.light,
        dark: alias.border.onVibrant.dark,
      },
    },
    dataviz: {
      categorical: {
        series: {
          1: {
            light: generateCategorical(color.categorical.light, 1),
            dark: generateCategorical(color.categorical.dark, 1),
            ash: generateCategorical(color.categorical.dark, 1),
            midnight: generateCategorical(color.categorical.dark, 1),
          },
          2: {
            light: generateCategorical(color.categorical.light, 2),
            dark: generateCategorical(color.categorical.dark, 2),
            ash: generateCategorical(color.categorical.dark, 3),
            midnight: generateCategorical(color.categorical.dark, 3),
          },
          3: {
            light: generateCategorical(color.categorical.light, 3),
            dark: generateCategorical(color.categorical.dark, 3),
            ash: generateCategorical(color.categorical.dark, 3),
            midnight: generateCategorical(color.categorical.dark, 3),
          },
          4: {
            light: generateCategorical(color.categorical.light, 4),
            dark: generateCategorical(color.categorical.dark, 4),
            ash: generateCategorical(color.categorical.dark, 4),
            midnight: generateCategorical(color.categorical.dark, 4),
          },
          5: {
            light: generateCategorical(color.categorical.light, 5),
            dark: generateCategorical(color.categorical.dark, 5),
            ash: generateCategorical(color.categorical.dark, 5),
            midnight: generateCategorical(color.categorical.dark, 5),
          },
          6: {
            light: generateCategorical(color.categorical.light, 6),
            dark: generateCategorical(color.categorical.dark, 6),
            ash: generateCategorical(color.categorical.dark, 6),
            midnight: generateCategorical(color.categorical.dark, 6),
          },
          7: {
            light: generateCategorical(color.categorical.light, 7),
            dark: generateCategorical(color.categorical.dark, 7),
            ash: generateCategorical(color.categorical.dark, 7),
            midnight: generateCategorical(color.categorical.dark, 7),
          },
          8: {
            light: generateCategorical(color.categorical.light, 8),
            dark: generateCategorical(color.categorical.dark, 8),
            ash: generateCategorical(color.categorical.dark, 8),
            midnight: generateCategorical(color.categorical.dark, 8),
          },
          9: {
            light: generateCategorical(color.categorical.light, 9),
            dark: generateCategorical(color.categorical.dark, 9),
            ash: generateCategorical(color.categorical.dark, 9),
            midnight: generateCategorical(color.categorical.dark, 9),
          },
          10: {
            light: generateCategorical(color.categorical.light, 10),
            dark: generateCategorical(color.categorical.dark, 10),
            ash: generateCategorical(color.categorical.dark, 10),
            midnight: generateCategorical(color.categorical.dark, 10),
          },
          11: {
            light: generateCategorical(color.categorical.light, 11),
            dark: generateCategorical(color.categorical.dark, 11),
            ash: generateCategorical(color.categorical.dark, 11),
            midnight: generateCategorical(color.categorical.dark, 11),
          },
        },
      },
      semantic: {
        other: {},
        neutral: {},
        release: {},
        accent: {},
        bad: {},
        meh: {},
        good: {},
      },
    },
  },
};

type CategoryScale = (typeof color)['categorical']['light'];
const SCALES_BY_MAX_LENGTH = new Map<number, (scale: CategoryScale) => string[]>([
  [
    6,
    (scale: CategoryScale) => [
      scale.blurple,
      scale.indigo,
      scale.pink,
      scale.orange,
      scale.yellow,
      scale.green,
    ],
  ],
  [
    7,
    (scale: CategoryScale) => [
      scale.blurple,
      scale.purple,
      scale.indigo,
      scale.pink,
      scale.orange,
      scale.yellow,
      scale.green,
    ],
  ],
  [
    8,
    (scale: CategoryScale) => [
      scale.blurple,
      scale.purple,
      scale.indigo,
      scale.plum,
      scale.pink,
      scale.orange,
      scale.yellow,
      scale.green,
    ],
  ],
  [
    9,
    (scale: CategoryScale) => [
      scale.blurple,
      scale.purple,
      scale.indigo,
      scale.plum,
      scale.magenta,
      scale.pink,
      scale.orange,
      scale.yellow,
      scale.green,
    ],
  ],
  [
    10,
    (scale: CategoryScale) => [
      scale.blurple,
      scale.purple,
      scale.indigo,
      scale.plum,
      scale.magenta,
      scale.pink,
      scale.salmon,
      scale.orange,
      scale.yellow,
      scale.green,
    ],
  ],
  [
    11,
    (scale: CategoryScale) => [
      scale.blurple,
      scale.purple,
      scale.indigo,
      scale.plum,
      scale.magenta,
      scale.pink,
      scale.salmon,
      scale.orange,
      scale.yellow,
      scale.lime,
      scale.green,
    ],
  ],
]);
function generateCategorical(scale: CategoryScale, length: 1): [string];
function generateCategorical(scale: CategoryScale, length: 2): [string, string];
function generateCategorical(scale: CategoryScale, length: 3): [string, string, string];
function generateCategorical(
  scale: CategoryScale,
  length: 4
): [string, string, string, string];
function generateCategorical(
  scale: CategoryScale,
  length: 5
): [string, string, string, string, string];
function generateCategorical(
  scale: CategoryScale,
  length: 6
): [string, string, string, string, string, string];
function generateCategorical(
  scale: CategoryScale,
  length: 7
): [string, string, string, string, string, string, string];
function generateCategorical(
  scale: CategoryScale,
  length: 8
): [string, string, string, string, string, string, string, string];
function generateCategorical(
  scale: CategoryScale,
  length: 9
): [string, string, string, string, string, string, string, string, string];
function generateCategorical(
  scale: CategoryScale,
  length: 10
): [string, string, string, string, string, string, string, string, string, string];
function generateCategorical(
  scale: CategoryScale,
  length: 11
): [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];
function generateCategorical(scale: CategoryScale, length: number): string[];
function generateCategorical<L extends number>(
  scale: CategoryScale,
  length: L
): string[] {
  for (const [size, makeScale] of SCALES_BY_MAX_LENGTH.entries()) {
    if (length <= size) {
      return makeScale(scale).slice(0, length);
    }
  }
  return [];
}
