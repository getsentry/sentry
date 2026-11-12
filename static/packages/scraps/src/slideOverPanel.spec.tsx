import type * as React from 'react';
import {createRef} from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';

import {OverlayContextProvider} from '@sentry/scraps/overlayContext';
import {SlideOverPanel} from '@sentry/scraps/slideOverPanel';
import {lightTheme} from '@sentry/scraps/theme';

const wrapper = ({children}: {children: React.ReactNode}) => (
  <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>
);

describe('SlideOverPanel', () => {
  it('renders standalone with a ref and accessible label', async () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <SlideOverPanel ariaLabel="Details" ref={ref} position="right">
        Content
      </SlideOverPanel>,
      {wrapper}
    );
    expect(await screen.findByText('Content')).toBeInTheDocument();
    expect(ref.current).toBe(screen.getByRole('complementary', {name: 'Details'}));
  });

  it('passes opening state to its renderer before showing full content', async () => {
    const openingStates: boolean[] = [];
    render(
      <SlideOverPanel>
        {({isOpening}) => {
          openingStates.push(isOpening);
          return isOpening ? 'Loading' : 'Ready';
        }}
      </SlideOverPanel>,
      {wrapper}
    );
    expect(await screen.findByText('Ready')).toBeInTheDocument();
    expect(openingStates[0]).toBe(true);
    expect(openingStates.at(-1)).toBe(false);
  });

  it('uses the supplied content offset for a passive panel', async () => {
    render(
      <OverlayContextProvider value={{contentTop: '80px'}}>
        <SlideOverPanel position="right" mode="passive">
          Content
        </SlideOverPanel>
      </OverlayContextProvider>,
      {wrapper}
    );
    expect(await screen.findByText('Content')).toBeInTheDocument();
    expect(screen.getByRole('complementary')).toHaveStyle({top: '80px'});
  });

  it('allows an explicit top offset to take precedence', async () => {
    render(
      <OverlayContextProvider value={{contentTop: '80px'}}>
        <SlideOverPanel position="left" topOffset="24px">
          Content
        </SlideOverPanel>
      </OverlayContextProvider>,
      {wrapper}
    );
    expect(await screen.findByText('Content')).toBeInTheDocument();
    expect(screen.getByRole('complementary')).toHaveStyle({top: '24px'});
  });
});
