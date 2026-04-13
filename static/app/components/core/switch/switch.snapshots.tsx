import {ThemeProvider} from '@emotion/react';

import {Switch, type SwitchProps} from '@sentry/scraps/switch';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const themes = {light: lightTheme, dark: darkTheme};

describe('Switch', () => {
  describe.each(['light', 'dark'] as const)('theme-%s', themeName => {
    it.snapshot.each<SwitchProps['size']>(['sm', 'lg'])('size-%s-unchecked', size => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Switch size={size} onChange={() => {}} />
        </div>
      </ThemeProvider>
    ));

    it.snapshot.each<SwitchProps['size']>(['sm', 'lg'])('size-%s-checked', size => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Switch checked size={size} onChange={() => {}} />
        </div>
      </ThemeProvider>
    ));

    it.snapshot('disabled-unchecked', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Switch disabled onChange={() => {}} />
        </div>
      </ThemeProvider>
    ));

    it.snapshot('disabled-checked', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Switch checked disabled onChange={() => {}} />
        </div>
      </ThemeProvider>
    ));
  });
});
