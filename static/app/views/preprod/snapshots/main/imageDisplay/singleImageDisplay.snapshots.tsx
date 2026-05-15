import {ThemeProvider} from '@emotion/react';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import {SingleImageDisplay} from './singleImageDisplay';

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

describe('SingleImageDisplay', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    function Wrapper({children}: {children: React.ReactNode}) {
      return (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{height: 240, width: 720}}>{children}</div>
        </ThemeProvider>
      );
    }

    it.snapshot(
      'basic-image-display',
      () => (
        <Wrapper>
          <SingleImageDisplay
            imageUrl="/visual-snapshots/images/head-button-light/"
            alt="Button / light"
          />
        </Wrapper>
      ),
      {theme: themeName, state: 'basic-image-display'}
    );
  });
});
