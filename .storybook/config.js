import React from 'react';
import {ThemeProvider} from 'emotion-theming';
import {configure, setAddon, getStorybook, addDecorator} from '@storybook/react';
import createPercyAddon from '@percy-io/percy-storybook';
import infoAddon, {setDefaults} from '@storybook/addon-info';
import {withKnobs} from '@storybook/addon-knobs';
import theme from '../src/sentry/static/sentry/app/utils/theme';
import './storybook.less';

const withTheme = storyFn => <ThemeProvider theme={theme}>{storyFn()}</ThemeProvider>;

const {percyAddon, serializeStories} = createPercyAddon();
setAddon(percyAddon);

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

serializeStories(getStorybook);
