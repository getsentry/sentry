import {configure, setAddon} from '@storybook/react';
import infoAddon, {setDefaults} from '@storybook/addon-info';

setDefaults({
  inline: true,
  header: false,
  source: true
});
setAddon(infoAddon);

// Use webpack's require.context to load modules dynamically
// From https://storybook.js.org/basics/writing-stories/
const req = require.context('../docs-ui/components', true, /\.stories\.js$/);

configure(function() {
  require('../docs-ui/index.js');
  req.keys().forEach(filename => req(filename));
}, module);
