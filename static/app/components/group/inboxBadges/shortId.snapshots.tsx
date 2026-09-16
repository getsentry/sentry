import {ThemeProvider} from '@emotion/react';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import {ShortId} from './shortId';

const themes = {light: lightTheme, dark: darkTheme};

describe('ShortId', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot(
      'default',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <ShortId shortId="JAVASCRIPT-ABC" />
          </div>
        </ThemeProvider>
      ),
      {theme: themeName}
    );

    it.snapshot(
      'with-avatar',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <ShortId
              shortId="JAVASCRIPT-ABC"
              avatar={
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: '#6C5FC7',
                  }}
                />
              }
            />
          </div>
        </ThemeProvider>
      ),
      {theme: themeName}
    );

    it.snapshot(
      'overflow',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 80}}>
            <ShortId shortId="VERY-LONG-PROJECT-IDENTIFIER-12345" />
          </div>
        </ThemeProvider>
      ),
      {theme: themeName}
    );
  });
});
