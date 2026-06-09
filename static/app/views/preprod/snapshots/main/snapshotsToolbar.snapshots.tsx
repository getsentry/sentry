import {Fragment} from 'react';
import {ThemeProvider} from '@emotion/react';

import {CompactSelect as mockCompactSelect} from 'sentry-test/snapshots/mocks/compactSelect';

import {Tag} from '@sentry/scraps/badge';

import {t} from 'sentry/locale';
// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import type {DiffMode} from './imageDisplay/diffImageDisplay';

jest.mock('@sentry/scraps/compactSelect', () => ({CompactSelect: mockCompactSelect}));

import {
  ColorPickerButton,
  DiffModeToggle,
  ProgressCounter,
  ProgressPill,
  type SortBy,
  SortDropdown,
  SoloDiffToggle,
  ToolbarContainer,
  ToolbarProgressBar,
  type ViewMode,
  ViewModeToggle,
} from './snapshotsToolbar';

// Test-only convenience wrapper that maps a flat props API onto the slot-based
// ToolbarContainer, mirroring how SnapshotMainContent composes the real toolbar
// from the same presentational components in production.
function SnapshotsToolbarWithControls({
  viewMode,
  onViewModeChange,
  progress,
  sort,
  diff,
  solo,
}: {
  onViewModeChange: (mode: ViewMode) => void;
  viewMode: ViewMode;
  diff?: {
    mode: DiffMode;
    onModeChange: (mode: DiffMode) => void;
    onOverlayColorChange: (color: string) => void;
    overlayColor: string;
    showSplit?: boolean;
  };
  progress?: {
    current: number;
    percent: number;
    total: number;
  };
  solo?:
    | 'base'
    | {
        isActive: boolean;
        onToggle: () => void;
      };
  sort?: {
    onChange: (sort: SortBy) => void;
    value: SortBy;
  };
}) {
  let soloDiffToggle: React.ReactNode = null;
  if (solo === 'base') {
    soloDiffToggle = <Tag variant="promotion">{t('Base')}</Tag>;
  } else if (solo) {
    soloDiffToggle = (
      <SoloDiffToggle isSoloView={solo.isActive} onToggleSoloView={solo.onToggle} />
    );
  }

  return (
    <ToolbarContainer
      toggle={<ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />}
      sortDropdown={
        sort ? <SortDropdown value={sort.value} onChange={sort.onChange} /> : null
      }
      progressIndicator={
        progress ? (
          <ProgressPill>
            <ToolbarProgressBar value={progress.percent} />
            <ProgressCounter size="xs" variant="muted">
              {progress.current}/{progress.total}
            </ProgressCounter>
          </ProgressPill>
        ) : null
      }
      diffControls={
        diff ? (
          <Fragment>
            {diff.mode === 'split' && (
              <ColorPickerButton
                color={diff.overlayColor}
                onChange={diff.onOverlayColorChange}
              />
            )}
            <DiffModeToggle
              diffMode={diff.mode}
              onDiffModeChange={diff.onModeChange}
              showSplit={diff.showSplit ?? true}
            />
          </Fragment>
        ) : null
      }
      soloDiffToggle={soloDiffToggle}
    />
  );
}

const themes = {light: lightTheme, dark: darkTheme};

const noop = () => {};

describe('SnapshotsToolbar', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot.breakpoints(
      ['xs', 'sm', 'md'],
      'all controls',
      width => {
        const isSm = width >= parseInt(themes[themeName].breakpoints.sm, 10);
        return (
          <ThemeProvider theme={themes[themeName]}>
            <div style={{width: '100%'}}>
              <SnapshotsToolbarWithControls
                viewMode="list"
                onViewModeChange={noop}
                progress={{current: 3, total: 12, percent: 25}}
                sort={{value: 'diff', onChange: noop}}
                diff={{
                  mode: isSm ? 'split' : 'wipe',
                  onModeChange: noop,
                  overlayColor: '#f55459',
                  onOverlayColorChange: noop,
                  showSplit: isSm,
                }}
                solo={{isActive: false, onToggle: noop}}
              />
            </div>
          </ThemeProvider>
        );
      },
      {tags: {area: 'snapshots'}}
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
      {tags: {area: 'snapshots'}}
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
      {tags: {area: 'snapshots'}}
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
      {tags: {area: 'snapshots'}}
    );
  });
});
