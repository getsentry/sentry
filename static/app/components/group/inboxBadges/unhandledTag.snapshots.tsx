import {ThemeProvider} from '@emotion/react';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import {UnhandledTag} from './unhandledTag';

const themes = {light: lightTheme, dark: darkTheme};

describe('UnhandledTag', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot(
      'default',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <UnhandledTag />
          </div>
        </ThemeProvider>
      ),
      {theme: themeName}
    );
  });
});
