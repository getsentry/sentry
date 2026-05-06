import {ThemeProvider} from '@emotion/react';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';
import type {
  SnapshotDiffPair,
  SnapshotImage,
} from 'sentry/views/preprod/types/snapshotTypes';

import {DiffImageDisplay} from './diffImageDisplay';

jest.mock('@sentry/scraps/image', () => {
  function Image({alt, className}: {alt?: string; className?: string}) {
    return (
      <div
        aria-label={alt}
        className={className}
        role="img"
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
          minWidth: 220,
        }}
      >
        PLACEHOLDER IMAGE
      </div>
    );
  }

  return {Image};
});

jest.mock('sentry/utils/useDimensions', () => ({
  useDimensions: () => ({height: 260, width: 852}),
}));

jest.mock('./useD3Zoom', () => {
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
const imageBaseUrl = '/visual-snapshots/images/';
const diffImageBaseUrl = '/visual-snapshots/diffs/';
const displayHeights = {
  onion: 240,
  split: 300,
  wipe: 260,
};

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

const pair: SnapshotDiffPair = {
  base_image: image({
    content_hash: 'base-content-hash',
    key: 'base-button-light',
  }),
  diff: 0.042,
  diff_image_key: 'diff-button-light',
  head_image: image({
    content_hash: 'head-content-hash',
    key: 'head-button-light',
  }),
};

describe('DiffImageDisplay', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    function Wrapper({
      children,
      diffMode,
    }: {
      children: React.ReactNode;
      diffMode: keyof typeof displayHeights;
    }) {
      return (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{height: displayHeights[diffMode], width: 900}}>{children}</div>
        </ThemeProvider>
      );
    }

    it.snapshot.each(['split', 'wipe', 'onion'] as const)(
      '%s',
      diffMode => (
        <Wrapper diffMode={diffMode}>
          <DiffImageDisplay
            pair={pair}
            imageBaseUrl={imageBaseUrl}
            diffImageBaseUrl={diffImageBaseUrl}
            overlayColor="rgba(219, 66, 66, 0.65)"
            diffMode={diffMode}
          />
        </Wrapper>
      ),
      diffMode => ({theme: themeName, state: diffMode})
    );

    it.snapshot(
      'split-missing-diff-image-key',
      () => (
        <Wrapper diffMode="split">
          <DiffImageDisplay
            pair={{...pair, diff_image_key: null}}
            imageBaseUrl={imageBaseUrl}
            diffImageBaseUrl={diffImageBaseUrl}
            overlayColor="rgba(219, 66, 66, 0.65)"
            diffMode="split"
          />
        </Wrapper>
      ),
      {theme: themeName, state: 'split-missing-diff-image-key'}
    );
  });
});
