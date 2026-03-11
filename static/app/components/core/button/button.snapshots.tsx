import {ThemeProvider} from '@emotion/react';

import {Button, type ButtonProps} from '@sentry/scraps/button';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const themes = {light: lightTheme, dark: darkTheme};

describe('Button', () => {
  describe.each(['light', 'dark'] as const)('theme-%s', themeName => {
    it.snapshot.each<ButtonProps['priority']>([
      'default',
      'primary',
      'danger',
      'warning',
      'link',
      'transparent',
    ])('priority-%s', priority => (
      <ThemeProvider theme={themes[themeName]}>
        {/* Buttons need a bit of padding as rootElement.screenshot() clips to the
          element's CSS border-box. For buttons, box-shadows/outlines/focus rings
          extending outside #root get cut off. */}

        <div style={{padding: 8}}>
          <Button priority={priority}>{priority}</Button>
        </div>
      </ThemeProvider>
    ));
  });
});
