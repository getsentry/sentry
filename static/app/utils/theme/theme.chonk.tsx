import {type Theme, useTheme} from '@emotion/react';
import styled, {
  type CreateStyledComponent,
  type FilteringStyledOptions,
} from '@emotion/styled';
import type {StyledOptions} from '@emotion/styled/dist/declarations/src/types';
import color from 'color';

import commonTheme, {
  type ColorMapping,
  darkTheme,
  generateAlertTheme,
  generateButtonTheme,
  generateLevelTheme,
  generateTagTheme,
  generateThemePrismVariables,
  generateThemeUtils,
  lightTheme,
} from 'sentry/utils/theme';

// @TODO(jonasbadalic): eventually, we should port component usage to these values
function generateChonkTokens(colorScheme: typeof lightColors) {
  return {
    content: {
      primary: colorScheme.dynamic.grayTransparent500,
      secondary: colorScheme.dynamic.grayTransparent400,
      accent: colorScheme.dynamic.blue400,
      success: colorScheme.dynamic.green400,
      warning: colorScheme.dynamic.yellow400,
      danger: colorScheme.dynamic.red400,
    },
    background: {
      primary: colorScheme.dynamic.surface500,
      secondary: colorScheme.dynamic.surface400,
      tertiary: colorScheme.dynamic.surface300,
    },
    border: {
      primary: colorScheme.dynamic.surface100,
      secondary: colorScheme.dynamic.surface200,
    },
    component: {
      button: {
        default: {
          chonk: colorScheme.dynamic.surface100,
          children: colorScheme.dynamic.grayTransparent500,
          background: {
            default: colorScheme.dynamic.surface500,
            hover: colorScheme.dynamic.surface400,
            active: colorScheme.dynamic.surface300,
          },
        },
        transparent: {
          chonk: colorScheme.dynamic.surface100,
          children: colorScheme.dynamic.grayTransparent500,
          background: {
            default: colorScheme.dynamic.surface500,
            hover: colorScheme.dynamic.surface400,
            active: colorScheme.dynamic.surface300,
          },
        },
        accent: {
          chonk: colorScheme.dynamic.blue100,
          children: colorScheme.static.white,
          background: {
            default: colorScheme.static.blue400,
            hover: colorScheme.static.blue300,
            active: colorScheme.static.blue200,
          },
        },
        warning: {
          chonk: colorScheme.dynamic.yellow100,
          children: colorScheme.static.black,
          background: {
            default: colorScheme.static.yellow400,
            hover: colorScheme.static.yellow300,
            active: colorScheme.static.yellow200,
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
      chart: {
        annotation: {
          axisLabel: colorScheme.dynamic.grayOpaque400,
        },
        canvas: {
          lineGrid: colorScheme.dynamic.grayOpaque100,
        },
      },
      link: {
        accent: {
          color: {
            default: colorScheme.dynamic.blue400,
            hover: colorScheme.dynamic.blue400,
            active: colorScheme.dynamic.blue400,
          },
        },
      },
      util: {
        outline: {
          accent: colorScheme.static.blue400,
          danger: colorScheme.static.red400,
        },
      },
    },
  };
}

const space = {
  nano: '1px',
  micro: '2px',
  mini: '4px',
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
} as const;

const radius = {
  nano: '1px',
  micro: '2px',
  mini: '3px',
  sm: '4px',
  md: '5px',
  lg: '6px',
  // @TODO(jonasbadalic): do we need an xl?
} as const;

const lightColors = {
  // @TODO(jonasbadalic): add explanation about static and dynamic color differences and intended usage
  static: {
    black: '#181423',
    white: '#F6F5FA',

    blue400: '#7553FF',
    blue300: '#6C4DEB',
    blue200: '#6246D4',
    blue100: '#553DB8',

    pink400: '#FF70BC',
    pink300: '#ED69AF',
    pink200: '#DB61A2',
    pink100: '#C45691',

    red400: '#E50045',
    red300: '#D4003F',
    red200: '#C2003B',
    red100: '#A80033',

    yellow400: '#FFD00E',
    yellow300: '#F0C40D',
    yellow200: '#E0B70C',
    yellow100: '#C9A30A',

    green400: '#00F261',
    green300: '#00E35B',
    green200: '#00D455',
    green100: '#00BF4D',
  },

  dynamic: {
    surface500: '#FFFFFF',
    surface400: '#FDFCFF',
    surface300: '#F9F7FC',
    surface200: '#ECEBF0', // Currently used for borderSecondary
    surface100: '#E2E1E5', // Currently used for button chonk & borderPrimary

    // @TODO(jonasbadalic): Why does gray opaque have 500?
    grayOpaque500: '#181423',
    grayOpaque400: '#6D6B74',
    grayOpaque300: '#939198',
    grayOpaque200: '#E0DFE2',
    grayOpaque100: '#F3F3F4',

    grayTransparent500: 'rgba(24, 20, 35, 1.0)',
    grayTransparent400: 'rgba(24, 20, 35, 0.63)',
    grayTransparent300: 'rgba(24, 20, 35, 0.47)',
    grayTransparent200: 'rgba(24, 20, 35, 0.14)',
    grayTransparent100: 'rgba(24, 20, 35, 0.05)',

    blue400: '#6C4DEB',
    blue300: '#5E42CC',
    blue200: '#523AB2',
    blue100: '#553DB8',

    pink400: '#BD337C',
    pink300: '#A32C6C',
    pink200: '#8F275E',
    pink100: '#962963',

    red400: '#CC003D',
    red300: '#B20036',
    red200: '#99002E',
    red100: '#A80033',

    yellow400: '#9D5710',
    yellow300: '#8A4D0F',
    yellow200: '#7B450F',
    yellow100: '#C9A30A',

    green400: '#17753D',
    green300: '#146635',
    green200: '#115A2E',
    green100: '#00BF4D',
  },
};

const darkColors: typeof lightColors = {
  static: {
    black: '#181423',
    white: '#F6F5FA',

    blue400: '#7553FF',
    blue300: '#6C4DEB',
    blue200: '#6246D4',
    blue100: '#553DB8',

    pink400: '#FF70BC',
    pink300: '#ED69AF',
    pink200: '#DB61A2',
    pink100: '#C45691',

    red400: '#E50045',
    red300: '#D4003F',
    red200: '#C2003B',
    red100: '#A80033',

    yellow400: '#FFD00E',
    yellow300: '#F0C40D',
    yellow200: '#E0B70C',
    yellow100: '#C9A30A',

    green400: '#00F261',
    green300: '#00E35B',
    green200: '#00D455',
    green100: '#00BF4D',
  },

  dynamic: {
    surface500: '#292536',
    surface400: '#252130',
    surface300: '#211E2B',
    surface200: '#191721', // Currently used for borderSecondary
    surface100: '#0B0A0F', // Currently used for button chonk & borderPrimary

    // @TODO(jonasbadalic): why 500 range?
    grayOpaque500: '#F6F5FA',
    grayOpaque400: '#A09DA8',
    grayOpaque300: '#767380',
    grayOpaque200: '#4D4A59',
    grayOpaque100: '#3D394A',

    // @TODO(jonasbadalic): why 500 range?
    grayTransparent500: 'rgba(246, 245, 250, 1.0)',
    grayTransparent400: 'rgba(246, 245, 250, 0.58)',
    grayTransparent300: 'rgba(246, 245, 250, 0.37)',
    grayTransparent200: 'rgba(246, 245, 250, 0.18)',
    grayTransparent100: 'rgba(246, 245, 250, 0.10)',

    blue400: '#A791FF',
    blue300: '#B7A6FF',
    blue200: '#C6B8FF',
    blue100: '#07050F',

    pink400: '#FF70BC',
    pink300: '#FF82C4',
    pink200: '#FF9CD0',
    pink100: '#0D0609',

    red400: '#FF759F',
    red300: '#FF8FB0',
    red200: '#FFA8C2',
    red100: '#1A0007',

    yellow400: '#FFE166',
    yellow300: '#FFE680',
    yellow200: '#FFEB99',
    yellow100: '#0A0800',

    green400: '#55F294',
    green300: '#6DF2A2',
    green200: '#85F2B1',
    green100: '#000A04',
  },
};

// Prism colors
// @TODO(jonasbadalic): are these final?
const prismLight = {
  /**
   * NOTE: Missing Palette All together
   * COMPONENTS AFFECTED: Unknown
   * TODO: Nothing yet, Low Prio
   */
  '--prism-base': '#332B3B',
  '--prism-inline-code': '#332B3B',
  '--prism-inline-code-background': '#F5F3F7',
  '--prism-highlight-background': '#5C78A31C',
  '--prism-highlight-accent': '#5C78A344',
  '--prism-comment': '#80708F',
  '--prism-punctuation': '#332B3B',
  '--prism-property': '#18408B',
  '--prism-selector': '#177861',
  '--prism-operator': '#235CC8',
  '--prism-variable': '#332B3B',
  '--prism-function': '#235CC8',
  '--prism-keyword': '#BB3A3D',
};

// @TODO(jonasbadalic): are these final?
const prismDark = {
  /**
   * NOTE: Missing Palette All together
   * COMPONENTS AFFECTED: Unknown
   * TODO: Nothing yet, Low Prio
   */
  '--prism-base': '#D6D0DC',
  '--prism-inline-code': '#D6D0DC',
  '--prism-inline-code-background': '#18121C',
  '--prism-highlight-background': '#A8A2C31C',
  '--prism-highlight-accent': '#A8A2C344',
  '--prism-comment': '#998DA5',
  '--prism-punctuation': '#D6D0DC',
  '--prism-property': '#70A2FF',
  '--prism-selector': '#1DCDA4',
  '--prism-operator': '#70A2FF',
  '--prism-variable': '#D6D0DC',
  '--prism-function': '#70A2FF',
  '--prism-keyword': '#F8777C',
};

// @TODO(jonasbadalic): are these final?
const lightShadows = {
  dropShadowLight: '0 0 1px rgba(43, 34, 51, 0.04)',
  dropShadowMedium: '0 1px 2px rgba(43, 34, 51, 0.04)',
  dropShadowHeavy: '0 4px 24px rgba(43, 34, 51, 0.12)',
  dropShadowHeavyTop: '0 -4px 24px rgba(43, 34, 51, 0.12)',
};

// @TODO(jonasbadalic): are these final?
const darkShadows = {
  dropShadowLight: '0 0 1px rgba(10, 8, 12, 0.2)',
  dropShadowMedium: '0 1px 2px rgba(10, 8, 12, 0.2)',
  dropShadowHeavy: '0 4px 24px rgba(10, 8, 12, 0.36)',
  dropShadowHeavyTop: '0 -4px 24px rgba(10, 8, 12, 0.36)',
};

const generateAliases = (
  tokens: ReturnType<typeof generateChonkTokens>,
  colors: typeof lightColors
) => ({
  /**
   * Heading text color
   */
  headingColor: tokens.content.primary,

  /**
   * Primary text color
   */
  textColor: tokens.content.primary,

  /**
   * Text that should not have as much emphasis
   */
  subText: tokens.content.secondary,

  /**
   * Background for the main content area of a page?
   */
  bodyBackground: tokens.background.secondary,

  /**
   * Primary background color
   */
  background: tokens.background.primary,

  /**
   * Elevated background color
   */
  backgroundElevated: tokens.background.primary,

  /**
   * Secondary background color used as a slight contrast against primary background
   */
  backgroundSecondary: tokens.background.secondary,

  /**
   * Tertiary background color used as a stronger contrast against primary background
   */
  backgroundTertiary: tokens.background.tertiary,

  /**
   * Background for the header of a page
   */
  headerBackground: tokens.background.primary,

  /**
   * Primary border color
   */
  border: tokens.border.primary,
  translucentBorder: tokens.border.primary,

  /**
   * Inner borders, e.g. borders inside of a grid
   */
  innerBorder: tokens.border.secondary,
  translucentInnerBorder: tokens.border.secondary,

  /**
   * A color that denotes a "success", or something good
   */
  success: tokens.content.success,
  successText: tokens.content.success,
  // @TODO(jonasbadalic): should this reference a static color?
  successFocus: colors.static.green200, // Not being used

  /**
   * A color that denotes an error, or something that is wrong
   */
  error: tokens.content.danger,
  errorText: tokens.content.danger,
  errorFocus: tokens.component.util.outline.danger,

  /**
   * A color that denotes danger, for dangerous actions like deletion
   */
  danger: tokens.content.danger,
  dangerText: tokens.content.danger,
  // @TODO(jonasbadalic): should this reference a static color?
  dangerFocus: tokens.component.util.outline.danger, // Not being used

  /**
   * A color that denotes a warning
   */
  warning: tokens.content.warning,
  warningText: tokens.content.warning,
  // @TODO(jonasbadalic): should this reference a static color?
  warningFocus: colors.dynamic.yellow200, // Not being used

  /**
   * A color that indicates something is disabled where user can not interact or use
   * it in the usual manner (implies that there is an "enabled" state)
   * NOTE: These are largely used for form elements, which I haven't mocked in ChonkUI
   */
  disabled: colors.dynamic.grayTransparent300,
  disabledBorder: colors.dynamic.grayTransparent300,

  /**
   * Indicates a "hover" state. Deprecated – use `InteractionStateLayer` instead for
   * interaction (hover/press) states.
   * @deprecated
   */
  hover: tokens.component.button.default.background.hover,

  /**
   * Indicates that something is "active" or "selected"
   * NOTE: These are largely used for form elements, which I haven't mocked in ChonkUI
   */
  active: colors.static.blue200,
  activeHover: colors.static.blue300,
  activeText: colors.static.blue400,

  /**
   * Indicates that something has "focus", which is different than "active" state as it is more temporal
   * and should be a bit subtler than active
   */
  focus: tokens.component.util.outline.accent,
  focusBorder: tokens.component.util.outline.accent,

  /**
   * Inactive
   * NOTE: Used in only a few places, but unclear how this would map to chonkUI
   */
  inactive: colors.dynamic.grayTransparent300,

  /**
   * Link color indicates that something is clickable
   */
  linkColor: tokens.component.link.accent.color.default,
  linkHoverColor: tokens.component.link.accent.color.hover,
  linkUnderline: tokens.component.link.accent.color.default,
  linkFocus: tokens.component.util.outline.accent,

  /**
   * Form placeholder text color
   */
  formPlaceholder: colors.dynamic.grayTransparent300,

  /**
   * Default form text color
   */
  formText: colors.dynamic.grayTransparent300,

  /**
   *
   */
  rowBackground: tokens.background.primary,

  /**
   * Color of lines that flow across the background of the chart to indicate axes levels
   * (This should only be used for yAxis)
   */
  chartLineColor: tokens.component.chart.annotation.axisLabel,

  /**
   * Color for chart label text
   */
  chartLabel: tokens.component.chart.canvas.lineGrid,

  /**
   * Color for the 'others' series in topEvent charts
   */
  chartOther: colors.dynamic.grayOpaque200,

  /**
   * Default Progressbar color
   */
  progressBar: colors.static.blue400,

  /**
   * Default Progressbar color
   */
  progressBackground: colors.dynamic.grayTransparent100,

  /**
   * Overlay for partial opacity
   */
  overlayBackgroundAlpha: colors.dynamic.grayTransparent100,

  /**
   * Tag progress bars
   */
  tagBarHover: colors.static.blue300,
  tagBar: colors.dynamic.grayTransparent200,

  // @todo(jonasbadalic) should these reference static colors?
  searchTokenBackground: {
    valid: colors.static.blue100,
    validActive: color(colors.static.blue100).opaquer(1.0).string(),
    invalid: colors.static.red100,
    invalidActive: color(colors.static.red100).opaquer(0.8).string(),
    warning: colors.static.yellow100,
    warningActive: color(colors.static.yellow100).opaquer(0.8).string(),
  },

  /**
   * Search filter "token" border
   * NOTE: Not being used anymore in the new Search UI
   */
  searchTokenBorder: {
    valid: colors.static.blue200,
    validActive: color(colors.static.blue200).opaquer(1).string(),
    invalid: colors.static.red200,
    invalidActive: color(colors.static.red200).opaquer(1).string(),
    warning: colors.static.yellow200,
    warningActive: color(colors.static.yellow200).opaquer(1).string(),
  },

  /**
   * Count on button when active
   */
  buttonCountActive: colors.static.white,

  /**
   * Count on button
   */
  buttonCount: tokens.content.primary,

  /**
   * Background of alert banners at the top
   */
  bannerBackground: colors.dynamic.grayTransparent500,
});

// Mapping of chonk theme to sentry theme
const chonkLightColorMapping: ColorMapping = {
  black: lightColors.static.black,
  white: lightColors.static.white,

  // @TODO(jonasbadalic): why is this needed?
  lightModeBlack: lightColors.static.black,
  lightModeWhite: lightColors.static.white,

  surface100: lightColors.dynamic.surface200,
  surface200: lightColors.dynamic.surface300,
  surface300: lightColors.dynamic.surface400,
  surface400: lightColors.dynamic.surface500,

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

  purple400: lightColors.dynamic.blue400,
  purple300: lightColors.dynamic.blue300,
  purple200: lightColors.dynamic.blue200,
  purple100: lightColors.dynamic.blue100,

  blue400: lightColors.dynamic.blue400,
  blue300: lightColors.dynamic.blue300,
  blue200: lightColors.dynamic.blue200,
  blue100: lightColors.dynamic.blue100,

  green400: lightColors.dynamic.green400,
  green300: lightColors.dynamic.green300,
  green200: lightColors.dynamic.green200,
  green100: lightColors.dynamic.green100,

  yellow400: lightColors.dynamic.yellow400,
  yellow300: lightColors.dynamic.yellow300,
  yellow200: lightColors.dynamic.yellow200,
  yellow100: lightColors.dynamic.yellow100,

  red400: lightColors.dynamic.red400,
  red300: lightColors.dynamic.red300,
  red200: lightColors.dynamic.red200,
  red100: lightColors.dynamic.red100,

  // @TODO(jonasbadalic): missing palette
  pink400: '#D1056B',
  pink300: '#F14499',
  pink200: 'rgba(249, 26, 138, 0.5)',
  pink100: 'rgba(249, 26, 138, 0.09)',
};

const chonkDarkColorMapping: ColorMapping = {
  black: darkColors.static.black,
  white: darkColors.static.white,

  lightModeBlack: darkColors.static.black,
  lightModeWhite: darkColors.static.white,

  surface100: darkColors.dynamic.surface200,
  surface200: darkColors.dynamic.surface300,
  surface300: darkColors.dynamic.surface400,
  surface400: darkColors.dynamic.surface500,

  translucentSurface100: darkColors.dynamic.surface100,
  translucentSurface200: darkColors.dynamic.surface200,

  surface500: darkColors.dynamic.surface300,

  gray500: darkColors.dynamic.grayOpaque500,
  gray400: darkColors.dynamic.grayOpaque400,
  gray300: darkColors.dynamic.grayOpaque300,
  gray200: darkColors.dynamic.grayOpaque200,
  gray100: darkColors.dynamic.grayOpaque100,

  translucentGray200: darkColors.dynamic.grayTransparent200,
  translucentGray100: darkColors.dynamic.grayTransparent100,

  purple400: darkColors.dynamic.blue400,
  purple300: darkColors.dynamic.blue300,
  purple200: darkColors.dynamic.blue200,
  purple100: darkColors.dynamic.blue100,

  blue400: darkColors.dynamic.blue400,
  blue300: darkColors.dynamic.blue300,
  blue200: darkColors.dynamic.blue200,
  blue100: darkColors.dynamic.blue100,

  green400: darkColors.dynamic.green400,
  green300: darkColors.dynamic.green300,
  green200: darkColors.dynamic.green200,
  green100: darkColors.dynamic.green100,

  yellow400: darkColors.dynamic.yellow400,
  yellow300: darkColors.dynamic.yellow300,
  yellow200: darkColors.dynamic.yellow200,
  yellow100: darkColors.dynamic.yellow100,

  red400: darkColors.dynamic.red400,
  red300: darkColors.dynamic.red300,
  red200: darkColors.dynamic.red200,
  red100: darkColors.dynamic.red100,

  // @TODO(jonasbadalic): missing palette
  pink400: '#EB8FBC',
  pink300: '#CE3B85',
  pink200: 'rgba(206, 59, 133, 0.25)',
  pink100: 'rgba(206, 59, 133, 0.13)',
};

const lightAliases = generateAliases(generateChonkTokens(lightColors), lightColors);
const darkAliases = generateAliases(generateChonkTokens(darkColors), darkColors);

interface ChonkTheme extends Omit<typeof lightTheme, 'isChonk'> {
  colors: typeof lightColors;
  isChonk: true;
  radius: typeof radius;
  space: typeof space;
}

export const DO_NOT_USE_lightChonkTheme: ChonkTheme = {
  isChonk: true,

  // @TODO: color theme contains some colors (like chart color palette, diff, tag and level)
  ...commonTheme,
  ...chonkLightColorMapping,
  ...lightAliases,
  ...lightShadows,

  inverted: {
    ...chonkDarkColorMapping,
    ...darkAliases,
  },

  space,
  radius,
  // @TODO: these colors need to be ported
  ...generateThemeUtils(chonkLightColorMapping, lightAliases),
  alert: generateAlertTheme(chonkLightColorMapping, lightAliases),
  button: generateButtonTheme(chonkLightColorMapping, lightAliases),
  tag: generateTagTheme(chonkLightColorMapping),
  level: generateLevelTheme(chonkLightColorMapping),

  prismVariables: generateThemePrismVariables(
    prismLight,
    lightAliases.backgroundSecondary
  ),
  prismDarkVariables: generateThemePrismVariables(
    prismDark,
    darkAliases.backgroundElevated
  ),

  stacktraceActiveBackground: lightTheme.stacktraceActiveBackground,
  stacktraceActiveText: lightTheme.stacktraceActiveText,

  colors: lightColors,

  sidebar: {
    // @TODO: these colors need to be ported
    ...lightTheme.sidebar,
  },
};

export const DO_NOT_USE_darkChonkTheme: ChonkTheme = {
  isChonk: true,

  // @TODO: color theme contains some colors (like chart color palette, diff, tag and level)
  ...commonTheme,
  ...chonkDarkColorMapping,
  ...darkAliases,
  ...darkShadows,

  inverted: {
    ...chonkDarkColorMapping,
    ...darkAliases,
  },

  // @TODO: these colors need to be ported
  ...generateThemeUtils(chonkDarkColorMapping, darkAliases),
  alert: generateAlertTheme(chonkDarkColorMapping, darkAliases),
  button: generateButtonTheme(chonkDarkColorMapping, darkAliases),
  tag: generateTagTheme(chonkDarkColorMapping),
  level: generateLevelTheme(chonkDarkColorMapping),

  prismVariables: generateThemePrismVariables(prismDark, darkAliases.backgroundSecondary),
  prismDarkVariables: generateThemePrismVariables(
    prismDark,
    darkAliases.backgroundElevated
  ),

  stacktraceActiveBackground: darkTheme.stacktraceActiveBackground,
  stacktraceActiveText: darkTheme.stacktraceActiveText,

  colors: darkColors,

  space,
  radius,
  sidebar: {
    // @TODO: these colors need to be ported
    ...darkTheme.sidebar,
  },
};

declare module '@emotion/react' {
  // @TODO(jonasbadalic): interface extending a type might be prone to some issues.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  export interface DO_NOT_USE_ChonkTheme extends ChonkTheme {
    isChonk: true;
  }

  /**
   * Configure Emotion to use our theme
   */
  type SentryTheme = typeof lightTheme;
  export interface Theme extends SentryTheme {
    isChonk: boolean;
  }
}

/**
 * Chonk utilities and overrrides to assert correct theme type
 * inside chonk components without having to check for theme.isChonk everywhere
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
interface DO_NOT_USE_ChonkTheme extends ChonkTheme {
  isChonk: true;
}

// Emotion has no override available for styled, so we create our own,
// which allows us to use chonkStyled and access the chonk theme and write
// our components with a future type API.
interface ChonkCreateStyled {
  <
    C extends React.ComponentClass<React.ComponentProps<C>>,
    ForwardedProps extends keyof React.ComponentProps<C> &
      string = keyof React.ComponentProps<C> & string,
  >(
    component: C,
    options: FilteringStyledOptions<React.ComponentProps<C>, ForwardedProps>
  ): CreateStyledComponent<
    Pick<React.ComponentProps<C>, ForwardedProps> & {
      theme?: DO_NOT_USE_ChonkTheme;
    },
    Record<string, unknown>,
    {
      ref?: React.Ref<InstanceType<C>>;
    }
  >;
  <C extends React.ComponentClass<React.ComponentProps<C>>>(
    component: C,
    options?: StyledOptions<React.ComponentProps<C>>
  ): CreateStyledComponent<
    React.ComponentProps<C> & {
      theme?: DO_NOT_USE_ChonkTheme;
    },
    Record<string, unknown>,
    {
      ref?: React.Ref<InstanceType<C>>;
    }
  >;
  <
    C extends React.ComponentType<React.ComponentProps<C>>,
    ForwardedProps extends keyof React.ComponentProps<C> &
      string = keyof React.ComponentProps<C> & string,
  >(
    component: C,
    options: FilteringStyledOptions<React.ComponentProps<C>, ForwardedProps>
  ): CreateStyledComponent<
    Pick<React.ComponentProps<C>, ForwardedProps> & {
      theme?: DO_NOT_USE_ChonkTheme;
    }
  >;
  <C extends React.ComponentType<React.ComponentProps<C>>>(
    component: C,
    options?: StyledOptions<React.ComponentProps<C>>
  ): CreateStyledComponent<
    React.ComponentProps<C> & {
      theme?: DO_NOT_USE_ChonkTheme;
    }
  >;
  <
    Tag extends keyof React.JSX.IntrinsicElements,
    ForwardedProps extends keyof React.JSX.IntrinsicElements[Tag] &
      string = keyof React.JSX.IntrinsicElements[Tag] & string,
  >(
    tag: Tag,
    options: FilteringStyledOptions<React.JSX.IntrinsicElements[Tag], ForwardedProps>
  ): CreateStyledComponent<
    {
      as?: React.ElementType;
      theme?: DO_NOT_USE_ChonkTheme;
    },
    Pick<React.JSX.IntrinsicElements[Tag], ForwardedProps>
  >;
  <Tag extends keyof React.JSX.IntrinsicElements>(
    tag: Tag,
    options?: StyledOptions<React.JSX.IntrinsicElements[Tag]>
  ): CreateStyledComponent<
    {
      as?: React.ElementType;
      theme?: DO_NOT_USE_ChonkTheme;
    },
    React.JSX.IntrinsicElements[Tag]
  >;
}

type ChonkStyled = {
  [Tag in keyof React.JSX.IntrinsicElements]: CreateStyledComponent<
    {
      as?: React.ElementType;
      theme?: DO_NOT_USE_ChonkTheme;
    },
    React.JSX.IntrinsicElements[Tag]
  >;
};

// Emotion has no override available for styled, so we create our own,
// which allows us to use chonkStyled and access the chonk theme and write
// our components with a future type API.
interface ChonkStyle extends ChonkCreateStyled, ChonkStyled {}
export const chonkStyled = styled as ChonkStyle;

export function useChonkTheme(): ChonkTheme {
  const theme = useTheme() as Theme | ChonkTheme;

  assertChonkTheme(theme);
  return theme;
}

function assertChonkTheme(theme: Theme): asserts theme is ChonkTheme {
  if (!theme.isChonk) {
    throw new Error('A chonk component may only be called inside a chonk theme context');
  }
}
