import {ThemeProvider} from '@emotion/react';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import {SnapshotsToolbar} from './snapshotsToolbar';

const themes = {light: lightTheme, dark: darkTheme};

function Pill({label}: {label: string}) {
  return (
    <div
      style={{
        alignItems: 'center',
        background: '#e8e5f0',
        borderRadius: 4,
        display: 'inline-flex',
        fontFamily: 'monospace',
        fontSize: 11,
        height: 24,
        padding: '0 8px',
      }}
    >
      {label}
    </div>
  );
}

const toggle = <Pill label="List | Single" />;
const sortDropdown = <Pill label="Sort: Diff %" />;
const progressIndicator = <Pill label="3/12" />;
const diffControls = (
  <div style={{display: 'flex', gap: 4}}>
    <Pill label="Color" />
    <Pill label="Split | Wipe | Onion" />
  </div>
);
const soloDiffToggle = <Pill label="Diff | Head" />;

describe('SnapshotsToolbar', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot(
      'all-slots',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{width: 960}}>
            <SnapshotsToolbar
              toggle={toggle}
              sortDropdown={sortDropdown}
              progressIndicator={progressIndicator}
              diffControls={diffControls}
              soloDiffToggle={soloDiffToggle}
            />
          </div>
        </ThemeProvider>
      ),
      {theme: themeName, state: 'all-slots'}
    );

    it.snapshot(
      'no-diff-controls',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{width: 960}}>
            <SnapshotsToolbar
              toggle={toggle}
              sortDropdown={sortDropdown}
              progressIndicator={progressIndicator}
              soloDiffToggle={soloDiffToggle}
            />
          </div>
        </ThemeProvider>
      ),
      {theme: themeName, state: 'no-diff-controls'}
    );

    it.snapshot(
      'toggle-only',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{width: 960}}>
            <SnapshotsToolbar toggle={toggle} />
          </div>
        </ThemeProvider>
      ),
      {theme: themeName, state: 'toggle-only'}
    );
  });
});
