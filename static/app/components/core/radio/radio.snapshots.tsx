import {ThemeProvider} from '@emotion/react';

import {Radio} from '@sentry/scraps/radio';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const themes = {light: lightTheme, dark: darkTheme};

describe('Radio', () => {
  describe.each(['light', 'dark'] as const)('theme-%s', themeName => {
    it.snapshot.each<'sm' | 'md'>(['sm', 'md'])(
      'size-%s-unchecked',
      size => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Radio size={size} onChange={() => {}} />
          </div>
        </ThemeProvider>
      ),
      size => ({tags: {theme: themeName, size, area: 'core'}})
    );

    it.snapshot.each<'sm' | 'md'>(['sm', 'md'])(
      'size-%s-checked',
      size => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Radio checked size={size} onChange={() => {}} />
          </div>
        </ThemeProvider>
      ),
      size => ({tags: {theme: themeName, size, checked: 'true', area: 'core'}})
    );

    it.snapshot(
      'disabled-unchecked',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Radio disabled onChange={() => {}} />
          </div>
        </ThemeProvider>
      ),
      {tags: {theme: themeName, disabled: 'true', area: 'core'}}
    );

    it.snapshot(
      'disabled-checked',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Radio checked disabled onChange={() => {}} />
          </div>
        </ThemeProvider>
      ),
      {tags: {theme: themeName, disabled: 'true', checked: 'true', area: 'core'}}
    );
  });
});
