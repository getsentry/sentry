import {ThemeProvider} from '@emotion/react';

import {Alert, type AlertProps} from '@sentry/scraps/alert';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const themes = {light: lightTheme, dark: darkTheme};

describe('Alert', () => {
  describe.each(['light', 'dark'] as const)('theme-%s', themeName => {
    it.snapshot.each<AlertProps['variant']>([
      'info',
      'warning',
      'success',
      'danger',
      'muted',
    ])('variant-%s', variant => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8, width: 400}}>
          <Alert variant={variant}>This is a {variant} alert</Alert>
        </div>
      </ThemeProvider>
    ));

    it.snapshot.each<AlertProps['variant']>([
      'info',
      'warning',
      'success',
      'danger',
      'muted',
    ])('variant-%s-no-icon', variant => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8, width: 400}}>
          <Alert variant={variant} showIcon={false}>
            This is a {variant} alert without icon
          </Alert>
        </div>
      </ThemeProvider>
    ));

    it.snapshot.each<AlertProps['variant']>([
      'info',
      'warning',
      'success',
      'danger',
      'muted',
    ])('variant-%s-system', variant => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8, width: 400}}>
          <Alert variant={variant} system>
            This is a system {variant} alert
          </Alert>
        </div>
      </ThemeProvider>
    ));
  });
});
