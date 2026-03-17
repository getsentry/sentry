import {ThemeProvider} from '@emotion/react';

// eslint-disable-next-line @sentry/scraps/no-core-import -- SSR snapshot needs direct import to avoid barrel re-exports with heavy deps
import {Badge, type BadgeProps} from 'sentry/components/core/badge/badge';
// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const themes = {light: lightTheme, dark: darkTheme};

describe('Badge', () => {
  describe.each(['light', 'dark'] as const)('theme-%s', themeName => {
    it.snapshot.each<BadgeProps['variant']>([
      'muted',
      'internal',
      'info',
      'success',
      'warning',
      'danger',
      'highlight',
      'promotion',
      'alpha',
      'beta',
      'new',
      'experimental',
    ])('variant-%s', variant => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Badge variant={variant}>{variant}</Badge>
        </div>
      </ThemeProvider>
    ));
  });
});
