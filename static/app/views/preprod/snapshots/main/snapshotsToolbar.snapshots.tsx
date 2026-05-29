import {Fragment} from 'react';
import {ThemeProvider} from '@emotion/react';

import {Tag} from '@sentry/scraps/badge';

import {t} from 'sentry/locale';
// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import type {DiffMode} from './imageDisplay/diffImageDisplay';

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
