import type * as React from 'react';
import {__unsafe_useEmotionCache, CacheProvider, ThemeProvider} from '@emotion/react';
import {act, renderHook} from '@testing-library/react';

import {lightTheme} from '@sentry/scraps/theme';

import {useRenderToString} from './renderToString';
import {Text} from './text';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('renderToString', () => {
  it('should render a simple component to string', async () => {
    function SimpleComponent() {
      return <div>Hello, World!</div>;
    }

    const {result} = renderHook(useRenderToString, {wrapper: ThemeWrapper});

    const string = await act(() => result.current(<SimpleComponent />));

    expect(string).toMatchInlineSnapshot('"<div>Hello, World!</div>"');
  });
  it('should render a scraps component to string', async () => {
    function ScrapsComponent() {
      return (
        <Text variant="success" data-test-id="rendered-text">
          SuccessText
        </Text>
      );
    }

    const {result} = renderHook(useRenderToString, {wrapper: ThemeWrapper});

    const string = await act(() => result.current(<ScrapsComponent />));

    expect(string).toContain('data-test-id="rendered-text"');
    expect(string).toContain('SuccessText');
  });

  it('should render with the caller emotion cache', async () => {
    function CacheWrapper({children}: {children: React.ReactNode}) {
      const cache = __unsafe_useEmotionCache();

      return (
        <CacheProvider value={cache && {...cache, key: 'caller'}}>
          <ThemeWrapper>{children}</ThemeWrapper>
        </CacheProvider>
      );
    }

    const {result} = renderHook(useRenderToString, {wrapper: CacheWrapper});

    const string = await act(() => result.current(<Text bold>Bold</Text>));

    expect(string).toMatch(/class="caller-/);
  });
});
