import React from 'react';
import {configure, setAddon, addDecorator} from '@storybook/react';
import {ThemeProvider} from 'emotion-theming';
import infoAddon, {setDefaults} from '@storybook/addon-info';
import {withKnobs} from '@storybook/addon-knobs';
import theme from '../src/sentry/static/sentry/app/utils/theme';
import './storybook.less';

const withTheme = storyFn => <ThemeProvider theme={theme}>{storyFn()}</ThemeProvider>;

setDefaults({
  inline: true,
  header: false,
  source: true,
});
setAddon(infoAddon);

addDecorator(withTheme);
addDecorator(withKnobs);
// Use webpack's require.context to load modules dynamically
// From https://storybook.js.org/basics/writing-stories/
const req = require.context('../docs-ui/components', true, /\.stories\.js$/);

configure(function() {
  require('../docs-ui/index.js');
  req.keys().forEach(filename => req(filename));
}, module);

// For percy integration
if (typeof window === 'object')
  window.__storybook_stories__ = require('@storybook/react').getStorybook();
