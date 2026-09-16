import {ThemeProvider} from '@emotion/react';

import {EventOrGroupType, type Level} from 'sentry/types/event';
// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import {EventMessage} from './eventMessage';

const themes = {light: lightTheme, dark: darkTheme};

describe('EventMessage', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot(
      'with-level-and-message',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 500}}>
            <EventMessage
              level="error"
              message="fetchData(app/components/group/suggestedOwners)"
              type={EventOrGroupType.ERROR}
            />
          </div>
        </ThemeProvider>
      ),
      {theme: themeName}
    );

    it.snapshot(
      'no-message',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 500}}>
            <EventMessage level="warning" message="" type={EventOrGroupType.ERROR} />
          </div>
        </ThemeProvider>
      ),
      {theme: themeName}
    );

    it.snapshot(
      'unhandled',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 500}}>
            <EventMessage
              level="error"
              message="TypeError: Cannot read properties of undefined"
              type={EventOrGroupType.ERROR}
              showUnhandled
            />
          </div>
        </ThemeProvider>
      ),
      {theme: themeName}
    );

    it.snapshot.each<Level>(['error', 'fatal', 'warning', 'info', 'sample', 'unknown'])(
      'level-%s',
      level => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 500}}>
            <EventMessage
              level={level}
              message="Test message for level"
              type={EventOrGroupType.ERROR}
            />
          </div>
        </ThemeProvider>
      ),
      level => ({theme: themeName, level})
    );
  });
});
