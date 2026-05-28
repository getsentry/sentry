import {ThemeProvider} from '@emotion/react';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

// Tooltips portal to `document.body` on render, which the SSR snapshot
// environment (no `document`) can't do. They're hover-only and never visible in
// a static snapshot, so render the trigger directly.
jest.mock('@sentry/scraps/tooltip', () => ({
  Tooltip: ({children}: {children: React.ReactNode}) => children,
}));

// CompactSelect's overlay control reads `document` during render to compute the
// dropdown boundary, which the SSR environment can't provide. The dropdown menu
// is never visible in a static snapshot anyway, so render only its trigger — the
// real DropdownButton the closed select shows in prod.
jest.mock('@sentry/scraps/compactSelect', () => {
  const {DropdownButton} = jest.requireActual('sentry/components/dropdownButton');
  return {
    CompactSelect: ({
      options,
      value,
      size,
    }: {
      options: Array<{label: React.ReactNode; value: unknown}>;
      size?: string;
      value?: unknown;
    }) => (
      <DropdownButton size={size}>
        {options.find(opt => opt.value === value)?.label}
      </DropdownButton>
    ),
  };
});

import {SnapshotsToolbarWithControls} from './snapshotsToolbar';

const themes = {light: lightTheme, dark: darkTheme};

const noop = () => {};

describe('SnapshotsToolbar', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot(
      'all controls',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{width: 960}}>
            <SnapshotsToolbarWithControls
              viewMode="list"
              onViewModeChange={noop}
              progress={{current: 3, total: 12, percent: 25}}
              sort={{value: 'diff', onChange: noop}}
              diff={{
                mode: 'split',
                onModeChange: noop,
                overlayColor: '#f55459',
                onOverlayColorChange: noop,
              }}
              solo={{isActive: false, onToggle: noop}}
            />
          </div>
        </ThemeProvider>
      ),
      {tags: {state: 'all-controls', area: 'snapshots'}}
    );

    it.snapshot(
      'no diff controls',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{width: 960}}>
            <SnapshotsToolbarWithControls
              viewMode="single"
              onViewModeChange={noop}
              progress={{current: 1, total: 5, percent: 0}}
              sort={{value: 'alpha', onChange: noop}}
              solo={{isActive: true, onToggle: noop}}
            />
          </div>
        </ThemeProvider>
      ),
      {tags: {state: 'no-diff-controls', area: 'snapshots'}}
    );

    it.snapshot(
      'solo base tag',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{width: 960}}>
            <SnapshotsToolbarWithControls
              viewMode="list"
              onViewModeChange={noop}
              progress={{current: 1, total: 3, percent: 0}}
              solo="base"
            />
          </div>
        </ThemeProvider>
      ),
      {tags: {state: 'solo-base', area: 'snapshots'}}
    );

    it.snapshot(
      'minimal',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{width: 960}}>
            <SnapshotsToolbarWithControls viewMode="list" onViewModeChange={noop} />
          </div>
        </ThemeProvider>
      ),
      {tags: {state: 'minimal', area: 'snapshots'}}
    );
  });
});
