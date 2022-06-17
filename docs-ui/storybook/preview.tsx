import 'focus-visible';
import 'docs-ui/index.js';

import {DocsContainer, Meta} from '@storybook/addon-docs';
import {addDecorator, addParameters, DecoratorFn, Parameters} from '@storybook/react';
import {ThemeProvider, themes} from '@storybook/theming';
import Code from 'docs-ui/components/code';
import ColorChip from 'docs-ui/components/colorChip';
import DocsLinks from 'docs-ui/components/docsLinks';
import DoDont from 'docs-ui/components/doDont';
import Sample from 'docs-ui/components/sample';
import TableOfContents from 'docs-ui/components/tableOfContents';
import {useDarkMode} from 'storybook-dark-mode';

import GlobalStyles from 'sentry/styles/global';
import {darkTheme, lightTheme, Theme} from 'sentry/utils/theme';

import {DocsGlobalStyles, StoryGlobalStyles} from './globalStyles';

type ExtendedTheme = Theme & {
  /**
   * [For Storybook only, do not use inside the app.]
   *
   * Substitute for the "background" property in Storybook components
   * (anything inside docs-ui), since Storybook overrides "background" with
   * its own object value.
   */
  docsBackground?: string;
};

// Theme decorator for stories
const WithThemeStory: DecoratorFn = (Story, context) => {
  const isDark = useDarkMode();
  const currentTheme = isDark ? darkTheme : lightTheme;

  // Set @storybook/addon-backgrounds current color based on theme
  if (context.globals.theme) {
    context.globals.backgrounds = {value: currentTheme.bodyBackground};
  }

  return (
    <ThemeProvider theme={currentTheme}>
      <GlobalStyles isDark={isDark} theme={currentTheme} />
      <StoryGlobalStyles theme={currentTheme} />
      <Story {...context} />
    </ThemeProvider>
  );
};

addDecorator(WithThemeStory);

// Theme decorator for MDX Docs
const WithThemeDocs: DecoratorFn = ({children, context}) => {
  const isDark = useDarkMode();
  const currentTheme: ExtendedTheme = isDark ? darkTheme : lightTheme;
  currentTheme.docsBackground = currentTheme.background;

  // Set @storybook/addon-backgrounds current color based on theme
  if (context.globals.theme) {
    context.globals.backgrounds = {value: currentTheme.bodyBackground};
  }

  const {hideToc} = context.parameters;

  return (
    <ThemeProvider theme={currentTheme}>
      <GlobalStyles isDark={isDark} theme={currentTheme} />
      <DocsGlobalStyles theme={currentTheme} />
      <DocsContainer context={context}>{children}</DocsContainer>
      <TableOfContents hidden={!!hideToc} />
    </ThemeProvider>
  );
};

// Option defaults:
addParameters({
  docs: {
    container: WithThemeDocs,
    components: {Meta, code: Code, ColorChip, DocsLinks, DoDont, Sample},
  },
  options: {
    /**
     * show story component as full screen
     * @type {Boolean}
     */
    isFullscreen: false,
    /**
     * display panel that shows a list of stories
     * @type {Boolean}
     */
    showNav: true,
    /**
     * display panel that shows addon configurations
     * @type {Boolean}
     */
    showPanel: true,
    /**
     * where to show the addon panel
     * @type {('bottom'|'right')}
     */
    panelPosition: 'bottom',
    /**
     * regex for finding the hierarchy separator
     * @example:
     *   null - turn off hierarchy
     *   /\// - split by `/`
     *   /\./ - split by `.`
     *   /\/|\./ - split by `/` or `.`
     * @type {Regex}
     */
    hierarchySeparator: /\/|\./,
    /**
     * regex for finding the hierarchy root separator
     * @example:
     *   null - turn off multiple hierarchy roots
     *   /\|/ - split by `|`
     * @type {Regex}
     */
    hierarchyRootSeparator: /\|/,
    /**
     * sidebar tree animat
     * ions
     * @type {Boolean}
     */
    sidebarAnimations: true,
    /**
     * enable/disable shortcuts
     * @type {Boolean}
     */
    enableShortcuts: true,
    /**
     * show/hide tool bar
     * @type {Boolean}
     */
    isToolshown: true,
    /**
     * function to sort stories in the tree view
     * common use is alphabetical `(a, b) => a[1].id.localeCompare(b[1].id)`
     * if left undefined, then the order in which the stories are imported will
     * be the order they display
     * @type {Function}
     */
    storySort: {
      order: [
        'Getting Started',
        'Changelog',
        'Core',
        ['Overview', 'Colors', 'Typography'],
        'Assets',
        ['Icons', 'Logo', 'Platforms'],
        'Components',
        [
          'Buttons',
          'Tables',
          'Forms',
          'Data Visualization',
          'Alerts',
          'Tags',
          'Badges',
          'Pills',
          'Tooltips',
          'Toast Indicators',
          'Loading Indicators',
          'Avatars',
          'Context Data',
          'Confirm',
          'Well',
        ],
        'Views',
        [
          'Layout - Narrow',
          'Layout - Thirds',
          'Sidebar Section',
          'Modals',
          'Activity',
          'Empty States',
          'Not Available',
          'Page Heading',
          'Tabs',
          'Breadcrumbs',
          'Detailed Error',
          'Onboarding Panel',
        ],
        'Utilities',
        [
          'Text',
          'Copy',
          'Clipboard',
          'Highlight',
          'Hidden Content',
          'Lazy Load',
          'Command Line',
          'Get Dynamic Text',
        ],
        'Features',
        'Deprecated',
      ],
    },
  },
});

const commonTheme = {
  brandTitle: 'Sentry UI System',
  brandUrl: '#',
  fontBase: '"Rubik", sans-serif',
};

const getThemeColors = (theme: ExtendedTheme) => ({
  appBg: theme.bodyBackground,
  appContentBg: theme.background,
  appBorderColor: theme.innerBorder,
  textColor: theme.textColor,
  textInverseColor: theme.white,
  barTextColor: theme.subText,
  barSelectedColor: theme.active,
  barBg: theme.background,
  inputBg: theme.backgroundElevated,
  inputBorder: theme.border,
  inputTextColor: theme.textColor,
});

export const parameters: Parameters = {
  darkMode: {
    dark: {
      ...themes.dark,
      ...commonTheme,
      ...getThemeColors(darkTheme),
    },
    light: {
      ...themes.normal,
      ...commonTheme,
      ...getThemeColors(lightTheme),
    },
  },
};

// Configure Emotion to use our theme
declare module '@emotion/react' {
  export interface Theme extends ExtendedTheme {}
}
