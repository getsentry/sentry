import {ThemeProvider} from '@emotion/react';

import {Chip} from '@sentry/scraps/chip';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const themes = {light: lightTheme, dark: darkTheme};
const SIZES = ['xs', 'sm', 'md'] as const;

describe('Chip', () => {
  describe.each(['light', 'dark'] as const)('theme-%s', themeName => {
    it.snapshot.each<(typeof SIZES)[number]>([...SIZES])(
      'query-size-%s',
      size => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Chip size={size} property="browser" operator="is" value="Chrome" />
          </div>
        </ThemeProvider>
      ),
      size => ({tags: {size, variant: 'query', area: 'core'}})
    );

    it.snapshot.each<(typeof SIZES)[number]>([...SIZES])(
      'readonly-query-size-%s',
      size => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Chip readonly size={size} property="browser" operator="is" value="Chrome" />
          </div>
        </ThemeProvider>
      ),
      size => ({tags: {size, variant: 'readonly-query', area: 'core'}})
    );

    it.snapshot.each<(typeof SIZES)[number]>([...SIZES])(
      'value-size-%s',
      size => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Chip size={size} value="Chrome" />
          </div>
        </ThemeProvider>
      ),
      size => ({tags: {size, variant: 'value', area: 'core'}})
    );

    it.snapshot(
      'query-dismissable',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Chip property="browser" operator="is" value="Chrome" onDismiss={() => {}} />
          </div>
        </ThemeProvider>
      ),
      {tags: {variant: 'query', dismissable: 'true', area: 'core'}}
    );

    it.snapshot(
      'value-dismissable',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Chip value="Chrome" onDismiss={() => {}} />
          </div>
        </ThemeProvider>
      ),
      {tags: {variant: 'value', dismissable: 'true', area: 'core'}}
    );
  });
});
