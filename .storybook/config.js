import 'focus-visible';
import React from 'react';
import {ThemeProvider} from 'emotion-theming';

import {configure, setAddon, getStorybook, addDecorator} from '@storybook/react';
import infoAddon, {setDefaults} from '@storybook/addon-info';
import {checkA11y} from '@storybook/addon-a11y';
import {setOptions} from '@storybook/addon-options';
import {withKnobs} from '@storybook/addon-knobs';

import theme from '../src/sentry/static/sentry/app/utils/theme';
import './storybook.less';

const withTheme = storyFn => <ThemeProvider theme={theme}>{storyFn()}</ThemeProvider>;

setDefaults({
  inline: true,
  header: false,
  source: false,
});
setAddon(infoAddon);
addDecorator(checkA11y);
addDecorator(withTheme);
addDecorator(withKnobs);
// Use webpack's require.context to load modules dynamically
// From https://storybook.js.org/basics/writing-stories/
const req = require.context('../docs-ui/components', true, /\.stories\.js$/);

// Option defaults:
setOptions({
  /**
   * name to display in the top left corner
   * @type {String}
   */
  name: 'Sentry Styleguide',

  /**
   * URL for name in top left corner to link to
   * @type {String}
   */
  url: '#',
  /**
   * show story component as full screen
   * @type {Boolean}
   */
  goFullScreen: false,

  /**
   * display panel that shows a list of stories
   * @type {Boolean}
   */
  showStoriesPanel: true,

  /**
   * display panel that shows addon configurations
   * @type {Boolean}
   */
  showAddonPanel: true,

  /**
   * display floating search box to search through stories
   * @type {Boolean}
   */
  showSearchBox: false,

  /**
   * show addon panel as a vertical panel on the right
   * @type {Boolean}
   */
  addonPanelInRight: false,

  /**
   * sorts stories
   * @type {Boolean}
   */
  sortStoriesByKind: false,

  /**
   * regex for finding the hierarchy separator
   * @example:
   *   null - turn off hierarchy
   *   /\// - split by `/`
   *   /\./ - split by `.`
   *   /\/|\./ - split by `/` or `.`
   * @type {Regex}
   */
  hierarchySeparator: /\/|\./, // matches a . or /

  /**
   * regex for finding the hierarchy root separator
   * @example:
   *   null - turn off multiple hierarchy roots
   *   /\|/ - split by `|`
   * @type {Regex}
   */
  hierarchyRootSeparator: /\|/, //matches a |

  /**
   * sidebar tree animations
   * @type {Boolean}
   */
  sidebarAnimations: true,

  /**
   * id to select an addon panel
   * @type {String}
   */
  selectedAddonPanel: undefined, // The order of addons in the "Addon panel" is the same as you import them in 'addons.js'. The first panel will be opened by default as you run Storybook
});

configure(function() {
  require('../docs-ui/index.js');
  req.keys().forEach(filename => req(filename));
}, module);
