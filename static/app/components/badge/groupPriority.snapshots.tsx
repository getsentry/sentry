import {ThemeProvider} from '@emotion/react';

import {PriorityLevel} from 'sentry/types/group';
// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import {GroupPriorityBadge} from './groupPriority';

const themes = {light: lightTheme, dark: darkTheme};

describe('GroupPriorityBadge', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot.each<PriorityLevel>([
      PriorityLevel.HIGH,
      PriorityLevel.MEDIUM,
      PriorityLevel.LOW,
    ])(
      '%s',
      priority => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <GroupPriorityBadge priority={priority} />
          </div>
        </ThemeProvider>
      ),
      priority => ({theme: themeName, priority: String(priority)})
    );

    it.snapshot(
      'icon-only',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <GroupPriorityBadge priority={PriorityLevel.HIGH} showLabel={false} />
          </div>
        </ThemeProvider>
      ),
      {theme: themeName}
    );
  });
});
