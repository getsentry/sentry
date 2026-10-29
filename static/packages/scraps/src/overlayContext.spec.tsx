import {createRef, Fragment} from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';

import {DrawerHeader, DrawerPanel} from '@sentry/scraps/drawer';
import {OverlayContextProvider} from '@sentry/scraps/overlayContext';
import {SlideOverPanel} from '@sentry/scraps/slideOverPanel';
import {lightTheme} from '@sentry/scraps/theme';

it('shares layout defaults across drawers, headers, and slide-over panels', async () => {
  const headerRef = createRef<HTMLHeadingElement>();
  render(
    <ThemeProvider theme={lightTheme}>
      <OverlayContextProvider
        value={{contentTop: '80px', headerHeight: '64px', isSmallScreen: true}}
      >
        <DrawerHeader ref={headerRef} />
        <SlideOverPanel position="right" mode="passive" ariaLabel="Panel">
          Panel content
        </SlideOverPanel>
        <DrawerPanel mode="blocking" ariaLabel="Drawer">
          Drawer content
        </DrawerPanel>
      </OverlayContextProvider>
    </ThemeProvider>
  );

  expect(await screen.findByText('Drawer content')).toBeInTheDocument();
  expect(headerRef.current).toHaveStyle({'--drawer-header-height': '64px'});
  expect(screen.getByRole('complementary', {name: 'Panel'})).toHaveStyle({top: '80px'});
  expect(screen.getByRole('complementary', {name: 'Drawer'})).toHaveStyle({
    '--drawer-width': '100%',
  });
});

it('updates header and panel layout without replacing their DOM nodes', async () => {
  const headerRef = createRef<HTMLHeadingElement>();
  const content = (
    <Fragment>
      <DrawerHeader ref={headerRef} />
      <SlideOverPanel position="right" mode="passive" ariaLabel="Panel">
        Panel content
      </SlideOverPanel>
    </Fragment>
  );
  const {rerender} = render(
    <ThemeProvider theme={lightTheme}>
      <OverlayContextProvider value={{contentTop: '80px', headerHeight: '64px'}}>
        {content}
      </OverlayContextProvider>
    </ThemeProvider>
  );
  expect(await screen.findByText('Panel content')).toBeInTheDocument();
  const panel = screen.getByRole('complementary', {name: 'Panel'});
  const header = headerRef.current;
  rerender(
    <ThemeProvider theme={lightTheme}>
      <OverlayContextProvider value={{contentTop: '96px', headerHeight: '72px'}}>
        {content}
      </OverlayContextProvider>
    </ThemeProvider>
  );
  expect(headerRef.current).toBe(header);
  expect(screen.getByRole('complementary', {name: 'Panel'})).toBe(panel);
  expect(header).toHaveStyle({'--drawer-header-height': '72px'});
  expect(panel).toHaveStyle({top: '96px'});
});
