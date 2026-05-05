import {ThemeProvider} from '@emotion/react';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';
import type {
  SnapshotDiffPair,
  SnapshotImage,
} from 'sentry/views/preprod/types/snapshotTypes';
import {DiffStatus} from 'sentry/views/preprod/types/snapshotTypes';

import {CardHeader, ImageCard, PairCard} from './snapshotCards';

jest.mock('@sentry/scraps/layout', () => {
  const actual = jest.requireActual('@sentry/scraps/layout');
  return {
    ...actual,
    Stack: (props: React.ComponentProps<typeof actual.Flex>) => (
      <actual.Flex direction="column" {...props} />
    ),
  };
});

jest.mock('@sentry/scraps/tooltip', () => ({
  Tooltip: ({children}: {children: React.ReactNode}) => children,
}));

jest.mock('sentry/utils/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({copy: jest.fn()}),
}));

jest.mock('sentry/utils/useDimensions', () => ({
  useDimensions: () => ({height: 320, width: 480}),
}));

jest.mock('./snapshotDiffBodies', () => {
  const actual = jest.requireActual('./snapshotDiffBodies');
  function PlaceholderImage() {
    return (
      <div
        style={{
          alignItems: 'center',
          background: '#f2f0f7',
          border: '1px dashed #8a8495',
          color: '#3f3a4a',
          display: 'flex',
          fontFamily: 'monospace',
          fontSize: 13,
          height: 120,
          justifyContent: 'center',
          width: '100%',
        }}
      >
        PLACEHOLDER IMAGE
      </div>
    );
  }

  return {
    ...actual,
    ImageColumn: ({label}: {label?: string | null}) => (
      <div style={{padding: 16}}>
        {label && <div style={{fontFamily: 'monospace', marginBottom: 8}}>{label}</div>}
        <PlaceholderImage />
      </div>
    ),
    OnionCardBody: () => (
      <div style={{display: 'grid', gap: 12, padding: 16}}>
        <PlaceholderImage />
        <div style={{fontFamily: 'monospace', textAlign: 'center'}}>50%</div>
      </div>
    ),
    SplitPairBody: ({headLabel}: {headLabel: string}) => (
      <div style={{display: 'grid', gap: 0, gridTemplateColumns: '1fr 1fr'}}>
        <div style={{padding: 16}}>
          <div style={{fontFamily: 'monospace', marginBottom: 8}}>Base</div>
          <PlaceholderImage />
        </div>
        <div style={{borderLeft: '1px solid #d8d3e3', padding: 16}}>
          <div style={{fontFamily: 'monospace', marginBottom: 8}}>{headLabel}</div>
          <PlaceholderImage />
        </div>
      </div>
    ),
    WipeCardBody: () => (
      <div style={{display: 'grid', gap: 12, padding: 16}}>
        <PlaceholderImage />
        <div style={{fontFamily: 'monospace', textAlign: 'center'}}>Wipe</div>
      </div>
    ),
  };
});

jest.mock('./imageDisplay/useD3Zoom', () => {
  const ReactActual = jest.requireActual('react');
  const noop = () => {};
  const createZoom = () => ({
    containerRef: ReactActual.createRef(),
    resetZoom: noop,
    transform: {x: 0, y: 0, k: 1},
    zoomBehaviorRef: ReactActual.createRef(),
    zoomIn: noop,
    zoomOut: noop,
  });

  return {
    useD3Zoom: createZoom,
    useSyncedD3Zoom: () => [createZoom(), createZoom()],
  };
});

const themes = {light: lightTheme, dark: darkTheme};
const noop = () => {};
const imageBaseUrl = '/visual-snapshots/images/';
const diffImageBaseUrl = '/visual-snapshots/diffs/';
const copyUrl = 'https://example.com/snapshots/button-light';

function image(overrides: Partial<SnapshotImage> = {}): SnapshotImage {
  return {
    content_hash: 'synthetic-content-hash',
    display_name: 'Button / light',
    height: 180,
    image_file_name: 'button.light.png',
    key: 'head-button-light',
    width: 320,
    ...overrides,
  };
}

const baseImage = image({
  content_hash: 'base-content-hash',
  display_name: 'Button / light',
  key: 'base-button-light',
});

const headImage = image({
  content_hash: 'head-content-hash',
  key: 'head-button-light',
});

const changedPair: SnapshotDiffPair = {
  base_image: baseImage,
  diff: 0.042,
  diff_image_key: 'diff-button-light',
  head_image: headImage,
};

const renamedPair: SnapshotDiffPair = {
  base_image: image({
    content_hash: 'base-renamed-content-hash',
    display_name: 'Button / light old',
    image_file_name: 'button.light.old.png',
    key: 'base-button-light-old',
  }),
  diff: null,
  diff_image_key: null,
  head_image: image({
    content_hash: 'head-renamed-content-hash',
    display_name: 'Button / light',
    image_file_name: 'button.light.png',
    key: 'head-button-light',
  }),
};

describe('SnapshotCards', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    function Wrapper({children}: {children: React.ReactNode}) {
      return (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{width: 720}}>{children}</div>
        </ThemeProvider>
      );
    }

    const headerProps = {
      copyData: headImage,
      copyUrl,
      fileName: 'button.light.png',
      isDark: false,
      onToggleDark: noop,
    };

    it.snapshot(
      'card-header-display-name-and-filename',
      () => (
        <Wrapper>
          <CardHeader
            {...headerProps}
            displayName="Button / light"
            status={DiffStatus.CHANGED}
            diffPercent={0.042}
          />
        </Wrapper>
      ),
      {theme: themeName, state: 'card-header-display-name-and-filename'}
    );

    it.snapshot(
      'card-header-filename-only',
      () => (
        <Wrapper>
          <CardHeader {...headerProps} displayName={null} status={DiffStatus.CHANGED} />
        </Wrapper>
      ),
      {theme: themeName, state: 'card-header-filename-only'}
    );

    function snapshotCardHeaderStatus({
      state,
      status,
      diffPercent,
    }: {
      state: string;
      diffPercent?: number | null;
      status?: DiffStatus | null;
    }) {
      it.snapshot(
        `card-header-${state}`,
        () => (
          <Wrapper>
            <CardHeader
              {...headerProps}
              displayName="Button / light"
              status={status}
              diffPercent={diffPercent}
            />
          </Wrapper>
        ),
        {theme: themeName, state: `card-header-${state}`}
      );
    }

    snapshotCardHeaderStatus({
      state: 'changed-with-diff-percent',
      status: DiffStatus.CHANGED,
      diffPercent: 0.042,
    });
    snapshotCardHeaderStatus({
      state: 'changed-without-diff-percent',
      status: DiffStatus.CHANGED,
      diffPercent: null,
    });
    snapshotCardHeaderStatus({state: 'added', status: DiffStatus.ADDED});
    snapshotCardHeaderStatus({state: 'removed', status: DiffStatus.REMOVED});
    snapshotCardHeaderStatus({state: 'renamed', status: DiffStatus.RENAMED});
    snapshotCardHeaderStatus({state: 'unchanged', status: DiffStatus.UNCHANGED});
    snapshotCardHeaderStatus({state: 'no-status', status: null});

    it.snapshot(
      'card-header-static',
      () => (
        <Wrapper>
          <CardHeader
            {...headerProps}
            displayName="Button / light"
            status={DiffStatus.CHANGED}
            diffPercent={0.042}
          />
        </Wrapper>
      ),
      {theme: themeName, state: 'card-header-static'}
    );

    function snapshotPairCard({
      state,
      pair,
      diffMode,
      isSelected,
    }: {
      diffMode: 'split' | 'wipe' | 'onion';
      isSelected: boolean;
      pair: SnapshotDiffPair;
      state: string;
    }) {
      it.snapshot(
        `pair-card-${state}`,
        () => (
          <Wrapper>
            <PairCard
              pair={pair}
              imageBaseUrl={imageBaseUrl}
              headBranch="Current Branch"
              isSelected={isSelected}
              copyUrl={copyUrl}
              diffMode={diffMode}
              overlayColor="rgba(219, 66, 66, 0.65)"
              diffImageBaseUrl={diffImageBaseUrl}
              snapshotKey={`button-light-${state}`}
              onSelectSnapshot={noop}
              onOpenSnapshot={noop}
            />
          </Wrapper>
        ),
        {theme: themeName, state: `pair-card-${state}`}
      );
    }

    snapshotPairCard({
      state: 'changed-split',
      pair: changedPair,
      diffMode: 'split',
      isSelected: false,
    });
    snapshotPairCard({
      state: 'changed-wipe',
      pair: changedPair,
      diffMode: 'wipe',
      isSelected: false,
    });
    snapshotPairCard({
      state: 'changed-onion',
      pair: changedPair,
      diffMode: 'onion',
      isSelected: false,
    });
    snapshotPairCard({
      state: 'selected-changed-split',
      pair: changedPair,
      diffMode: 'split',
      isSelected: true,
    });

    it.snapshot(
      'image-card-added-selected-with-display-name',
      () => (
        <Wrapper>
          <ImageCard
            image={headImage}
            cardType="added"
            imageBaseUrl={imageBaseUrl}
            isSelected
            copyUrl={copyUrl}
            snapshotKey="button-light-added"
            onSelectSnapshot={noop}
            onOpenSnapshot={noop}
          />
        </Wrapper>
      ),
      {theme: themeName, state: 'image-card-added-selected-with-display-name'}
    );

    it.snapshot(
      'image-card-removed-unselected',
      () => (
        <Wrapper>
          <ImageCard
            image={baseImage}
            cardType="removed"
            imageBaseUrl={imageBaseUrl}
            isSelected={false}
            copyUrl={copyUrl}
            snapshotKey="button-light-removed"
            onSelectSnapshot={noop}
            onOpenSnapshot={noop}
          />
        </Wrapper>
      ),
      {theme: themeName, state: 'image-card-removed-unselected'}
    );

    it.snapshot(
      'image-card-renamed-with-pair-metadata',
      () => (
        <Wrapper>
          <ImageCard
            image={renamedPair.head_image}
            cardType="renamed"
            copyData={renamedPair}
            imageBaseUrl={imageBaseUrl}
            isSelected={false}
            copyUrl={copyUrl}
            snapshotKey="button-light-renamed"
            onSelectSnapshot={noop}
            onOpenSnapshot={noop}
          />
        </Wrapper>
      ),
      {theme: themeName, state: 'image-card-renamed-with-pair-metadata'}
    );

    it.snapshot(
      'image-card-solo-filename-only-no-status',
      () => (
        <Wrapper>
          <ImageCard
            image={image({display_name: null})}
            cardType="solo"
            imageBaseUrl={imageBaseUrl}
            isSelected={false}
            copyUrl={copyUrl}
            snapshotKey="button-light-solo"
            onSelectSnapshot={noop}
            onOpenSnapshot={noop}
          />
        </Wrapper>
      ),
      {theme: themeName, state: 'image-card-solo-filename-only-no-status'}
    );
  });
});
