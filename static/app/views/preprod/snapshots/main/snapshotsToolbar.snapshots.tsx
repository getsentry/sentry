import {Fragment} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {CompactSelect as mockCompactSelect} from 'sentry-test/snapshots/mocks/compactSelect';

import {Tag} from '@sentry/scraps/badge';

import {t} from 'sentry/locale';
import {OrganizationContext} from 'sentry/utils/organizationContext';

import type {DiffMode} from './imageDisplay/diffImageDisplay';

jest.mock('@sentry/scraps/compactSelect', () => ({
  CompactSelect: mockCompactSelect,
}));

import {Container} from '@sentry/scraps/layout';

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
    onOverlayOpacityChange: (opacity: number) => void;
    overlayColor: string;
    overlayOpacity: number;
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
    <OrganizationContext value={organization}>
      <Container containerType="inline-size" width="100cqw">
        <ToolbarContainer
          toggle={
            <ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
          }
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
                    opacity={diff.overlayOpacity}
                    onOpacityChange={diff.onOverlayOpacityChange}
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
      </Container>
    </OrganizationContext>
  );
}

const organization = OrganizationFixture();

const noop = () => {};

describe('SnapshotsToolbar', () => {
  it.snapshot(
    'all controls',
    ({container}) => {
      const isCompact = container === 'xl';
      return (
        <SnapshotsToolbarWithControls
          viewMode="list"
          onViewModeChange={noop}
          progress={{current: 3, total: 12, percent: 25}}
          sort={{value: 'diff', onChange: noop}}
          diff={{
            mode: isCompact ? 'wipe' : 'split',
            onModeChange: noop,
            overlayColor: '#f55459',
            onOverlayColorChange: noop,
            overlayOpacity: 50,
            onOverlayOpacityChange: noop,
            showSplit: !isCompact,
          }}
          solo={{isActive: false, onToggle: noop}}
        />
      );
    },
    {tags: {area: 'snapshots'}}
  );

  it.snapshot(
    'no diff controls',
    () => (
      <SnapshotsToolbarWithControls
        viewMode="single"
        onViewModeChange={noop}
        progress={{current: 1, total: 5, percent: 0}}
        sort={{value: 'alpha', onChange: noop}}
        solo={{isActive: true, onToggle: noop}}
      />
    ),
    {tags: {area: 'snapshots'}}
  );

  it.snapshot(
    'solo base tag',
    () => (
      <SnapshotsToolbarWithControls
        viewMode="list"
        onViewModeChange={noop}
        progress={{current: 1, total: 3, percent: 0}}
        solo="base"
      />
    ),
    {tags: {area: 'snapshots'}}
  );

  it.snapshot(
    'minimal',
    () => <SnapshotsToolbarWithControls viewMode="list" onViewModeChange={noop} />,
    {tags: {area: 'snapshots'}}
  );

  it.snapshot.each<DiffMode>(['split', 'wipe', 'onion'])(
    '%s',
    diffMode => (
      <SnapshotsToolbarWithControls
        viewMode="single"
        onViewModeChange={noop}
        progress={{current: 1, total: 5, percent: 20}}
        diff={{
          mode: diffMode,
          onModeChange: noop,
          overlayColor: '#f55459',
          onOverlayColorChange: noop,
          overlayOpacity: 50,
          onOverlayOpacityChange: noop,
        }}
      />
    ),
    diffMode => ({tags: {area: 'snapshots', diffMode}})
  );
});
