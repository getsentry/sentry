import {configure, setAddon} from '@storybook/react';
import infoAddon, {setDefaults} from '@storybook/addon-info';

setDefaults({
  inline: true,
  header: false,
  source: true
});
setAddon(infoAddon);

configure(function() {
  require('../docs-ui/index.js');
}, module);
