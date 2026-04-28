import {ThemeProvider} from '@emotion/react';

import {InputGroup} from '@sentry/scraps/input';
import type {InputProps} from '@sentry/scraps/input';

import {IconSearch} from 'sentry/icons';
// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const themes = {light: lightTheme, dark: darkTheme};

describe('InputGroup', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot.each<InputProps['size']>(['md', 'sm', 'xs'])(
      'size-%s',
      size => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 300}}>
            <InputGroup>
              <InputGroup.Input size={size} placeholder={`size ${size}`} />
            </InputGroup>
          </div>
        </ThemeProvider>
      ),
      size => ({theme: themeName, size: String(size)})
    );

    it.snapshot('disabled', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8, width: 300}}>
          <InputGroup>
            <InputGroup.Input disabled placeholder="Disabled input" />
          </InputGroup>
        </div>
      </ThemeProvider>
    ));

    it.snapshot('with-leading-items', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8, width: 300}}>
          <InputGroup>
            <InputGroup.LeadingItems disablePointerEvents>
              <IconSearch />
            </InputGroup.LeadingItems>
            <InputGroup.Input placeholder="Search…" />
          </InputGroup>
        </div>
      </ThemeProvider>
    ));

    it.snapshot('with-leading-items-disabled', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8, width: 300}}>
          <InputGroup>
            <InputGroup.LeadingItems disablePointerEvents>
              <IconSearch />
            </InputGroup.LeadingItems>
            <InputGroup.Input disabled placeholder="Search…" />
          </InputGroup>
        </div>
      </ThemeProvider>
    ));
  });
});
