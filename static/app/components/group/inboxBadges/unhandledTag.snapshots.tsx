import {ThemeProvider} from '@emotion/react';

import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import {UnhandledTag} from './unhandledTag';

const themes = {light: lightTheme, dark: darkTheme};

describe('UnhandledTag', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot('default', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <UnhandledTag />
        </div>
      </ThemeProvider>
    ));
  });
});
