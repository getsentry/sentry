import {ThemeProvider} from '@emotion/react';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

jest.mock('@sentry/scraps/badge', () => ({
  Tag: ({children, ...props}: {children: React.ReactNode}) => (
    <span {...props}>{children}</span>
  ),
}));

jest.mock('@sentry/scraps/compactSelect', () => ({
  CompactSelect: () => <select />,
}));

jest.mock('@sentry/scraps/segmentedControl', () => {
  function MockSegmentedControl({children}: {children: React.ReactNode}) {
    return <div>{children}</div>;
  }
  MockSegmentedControl.Item = function ({children}: {children?: React.ReactNode}) {
    return <span>{children}</span>;
  };
  return {SegmentedControl: MockSegmentedControl};
});

jest.mock('@sentry/scraps/tooltip', () => ({
  Tooltip: ({children}: {children: React.ReactNode}) => children,
}));

jest.mock('sentry/components/progressBar', () => ({
  ProgressBar: () => <div />,
}));

jest.mock('sentry/icons', () => ({
  IconExpand: () => <span>⊞</span>,
  IconInput: () => <span>⊟</span>,
  IconList: () => <span>☰</span>,
  IconPause: () => <span>‖</span>,
  IconStack: () => <span>⊞</span>,
}));

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
