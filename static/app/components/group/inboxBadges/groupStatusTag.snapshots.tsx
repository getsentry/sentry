import {ThemeProvider} from '@emotion/react';

import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import {GroupStatusTag} from './groupStatusTag';

const themes = {light: lightTheme, dark: darkTheme};

describe('GroupStatusTag', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot.each<'sm' | 'md'>(['sm', 'md'])(
      'fontSize-%s',
      fontSize => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <GroupStatusTag fontSize={fontSize}>Ongoing</GroupStatusTag>
          </div>
        </ThemeProvider>
      ),
      fontSize => ({theme: themeName, fontSize})
    );
  });
});
