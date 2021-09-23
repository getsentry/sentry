import {addons} from '@storybook/addons';
import {create} from '@storybook/theming';

const theme = create({
  base: 'light',
  brandTitle: 'Sentry UI System',
  brandUrl: '#',
  fontBase: '"Rubik", sans-serif',
  // To control appearance:
  // brandImage: 'http://url.of/some.svg',
});

addons.setConfig({
  showRoots: true,
  panelPosition: 'bottom',
  theme,
});
