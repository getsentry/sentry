import 'focus-visible';
import 'docs-ui/index.js';

import {Fragment} from 'react';
import {DocsContainer, Meta} from '@storybook/addon-docs';
import {addDecorator, addParameters, DecoratorFn, Parameters} from '@storybook/react';
import Code from 'docs-ui/components/code';
import ColorChip from 'docs-ui/components/colorChip';
import DocsLinks from 'docs-ui/components/docsLinks';
import DoDont from 'docs-ui/components/doDont';
import Sample from 'docs-ui/components/sample';
import TableOfContents from 'docs-ui/components/tableOfContents';
import {ThemeProvider} from 'emotion-theming';

import GlobalStyles from 'app/styles/global';
import {darkTheme, lightTheme} from 'app/utils/theme';

import PreviewGlobalStyles from './previewGlobalStyles';

// Theme decorator for stories
const withThemeStory: DecoratorFn = (Story, context) => {
  const isDark = context.globals.theme === 'dark';
  const currentTheme = isDark ? darkTheme : lightTheme;

  // Set @storybook/addon-backgrounds current color based on theme
  if (context.globals.theme) {
    context.globals.backgrounds = {value: currentTheme.bodyBackground};
  }

  return (
    <ThemeProvider theme={currentTheme}>
      <GlobalStyles isDark={isDark} theme={currentTheme} />
      <Story {...context} />
    </ThemeProvider>
  );
};

addDecorator(withThemeStory);

// Theme decorator for MDX Docs
const withThemeDocs: DecoratorFn = ({children, context}) => {
  const isDark = context.globals.theme === 'dark';
  const currentTheme = isDark ? darkTheme : lightTheme;

  // Set @storybook/addon-backgrounds current color based on theme
  if (context.globals.theme) {
    context.globals.backgrounds = {value: currentTheme.bodyBackground};
  }

  return (
    <Fragment>
      <DocsContainer context={context}>
        <GlobalStyles isDark={isDark} theme={currentTheme} />
        <PreviewGlobalStyles theme={currentTheme} />
        <ThemeProvider theme={currentTheme}>{children}</ThemeProvider>
      </DocsContainer>
      <ThemeProvider theme={currentTheme}>
        <TableOfContents />
      </ThemeProvider>
    </Fragment>
  );
};

// Option defaults:
addParameters({
  docs: {
    container: withThemeDocs,
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
        ['Overview'],
        'Assets',
        ['Logo', 'Icons', 'Platforms'],
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

export const globalTypes = {
  theme: {
    name: 'Theme',
    description: 'Global theme for components',
    defaultValue: 'light',
    toolbar: {
      icon: 'circlehollow',
      // array of plain string values or MenuItem shape (see below)
      items: [
        {value: 'light', icon: 'circlehollow', title: 'light'},
        {value: 'dark', icon: 'circle', title: 'dark'},
      ],
    },
  },
};

export const parameters: Parameters = {
  /**
   * @storybook/addon-backgrounds background is controlled via theme
   */
  backgrounds: {
    grid: {
      disable: true,
    },
    default: 'light',
    values: [
      {
        name: 'light',
        value: lightTheme.background,
      },
      {
        name: 'dark',
        value: darkTheme.background,
      },
    ],
  },
};
