import 'focus-visible';
import '../docs-ui/index.js';

import {addDecorator, addParameters, DecoratorFn, Parameters} from '@storybook/react';
import {ThemeProvider} from 'emotion-theming';

import GlobalStyles from '../static/app/styles/global';
import {darkTheme, lightTheme} from '../static/app/utils/theme';

const withTheme: DecoratorFn = (Story, context) => {
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

addDecorator(withTheme);

// Option defaults:
addParameters({
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
        'Core',
        'Forms',
        'UI',
        'Layouts',
        'Charts',
        'DataVisualization',
        'Features',
        'Utilities',
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
