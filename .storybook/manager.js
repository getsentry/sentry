import {addons} from '@storybook/addons';
import {create} from '@storybook/theming/create';

const theme = create({
  base: 'light',
  brandTitle: 'Sentry Styleguide',
  brandUrl: '#',
  // To control appearance:
  // brandImage: 'http://url.of/some.svg',
});

addons.setConfig({
  showRoots: true,
  panelPosition: 'bottom',
  theme,
});
