import React from 'react';
import {ThemeProvider} from 'emotion-theming';
import {configure, setAddon, getStorybook, addDecorator} from '@storybook/react';
import infoAddon, {setDefaults} from '@storybook/addon-info';
import {checkA11y} from '@storybook/addon-a11y';
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
// Use webpack's require.context to load modules dynamically
// From https://storybook.js.org/basics/writing-stories/
const req = require.context('../docs-ui/components', true, /\.stories\.js$/);

configure(function() {
  require('../docs-ui/index.js');
  req.keys().forEach(filename => req(filename));
}, module);
