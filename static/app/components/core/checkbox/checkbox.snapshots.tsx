import {ThemeProvider} from '@emotion/react';

import {Checkbox, type CheckboxProps} from '@sentry/scraps/checkbox';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const themes = {light: lightTheme, dark: darkTheme};

describe('Checkbox', () => {
  describe.each(['light', 'dark'] as const)('theme-%s', themeName => {
    it.snapshot.each<CheckboxProps['checked']>([false, true, 'indeterminate'])(
      'checked-%s',
      checked => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Checkbox checked={checked} onChange={() => {}} />
          </div>
        </ThemeProvider>
      )
    );

    it.snapshot.each<CheckboxProps['size']>(['xs', 'sm', 'md'])('size-%s', size => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Checkbox checked size={size} onChange={() => {}} />
        </div>
      </ThemeProvider>
    ));

    it.snapshot('disabled-unchecked', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Checkbox disabled onChange={() => {}} />
        </div>
      </ThemeProvider>
    ));

    it.snapshot('disabled-checked', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Checkbox checked disabled onChange={() => {}} />
        </div>
      </ThemeProvider>
    ));
  });
});
