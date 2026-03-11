import {ThemeProvider} from '@emotion/react';

import {Text, type TextProps} from '@sentry/scraps/text';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const themes = {light: lightTheme, dark: darkTheme};

describe('Text', () => {
  describe.each(['light', 'dark'] as const)('theme-%s', themeName => {
    it.snapshot.each<TextProps<'span'>['size']>(['xs', 'sm', 'md', 'lg', 'xl', '2xl'])(
      'size-%s',
      size => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Text size={size}>Lorem ipsum dolor sit amet</Text>
          </div>
        </ThemeProvider>
      )
    );

    it.snapshot.each<TextProps<'span'>['variant']>([
      'primary',
      'secondary',
      'accent',
      'danger',
      'warning',
      'success',
      'muted',
    ])('variant-%s', variant => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text variant={variant}>Lorem ipsum dolor sit amet</Text>
        </div>
      </ThemeProvider>
    ));
  });
});
