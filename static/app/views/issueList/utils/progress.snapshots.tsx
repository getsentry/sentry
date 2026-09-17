import {ThemeProvider} from '@emotion/react';

import {Stack} from '@sentry/scraps/layout';

import {ProgressState} from 'sentry/types/group';
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import {formatProgressState, getProgressIcon} from './progress';

const themes = {light: lightTheme, dark: darkTheme};

const states = [
  ProgressState.IDENTIFIED,
  ProgressState.ASSIGNED,
  ProgressState.DIAGNOSED,
  ProgressState.FIX_PROPOSED,
  ProgressState.FIX_APPLIED,
];

describe('ProgressState', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot.each(states)(
      '%s',
      state => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Stack direction="row" align="center" gap="sm">
              {getProgressIcon(state)}
              {formatProgressState(state)}
            </Stack>
          </div>
        </ThemeProvider>
      ),
      state => ({tags: {area: 'core', state: String(state)}})
    );
  });
});
