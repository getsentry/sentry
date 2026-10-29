import type * as React from 'react';
import {createRef} from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {DrawerBody, DrawerHeader, DrawerPanel} from '@sentry/scraps/drawer';
import {OverlayContextProvider} from '@sentry/scraps/overlayContext';
import {lightTheme} from '@sentry/scraps/theme';

const wrapper = ({children}: {children: React.ReactNode}) => (
  <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>
);

describe('DrawerPanel', () => {
  it('renders without app providers and connects its close button and ref', async () => {
    const onClose = jest.fn();
    const ref = createRef<HTMLDivElement>();
    render(
      <DrawerPanel ref={ref} mode="blocking" ariaLabel="Details" onClose={onClose}>
        <DrawerHeader>Details</DrawerHeader>
        <DrawerBody>Content</DrawerBody>
      </DrawerPanel>,
      {wrapper}
    );

    expect(await screen.findByText('Content')).toBeInTheDocument();
    expect(ref.current).toBe(screen.getByRole('complementary', {name: 'Details'}));
    await userEvent.click(screen.getByRole('button', {name: 'Close Drawer'}));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses full width on small screens', async () => {
    render(
      <OverlayContextProvider value={{isSmallScreen: true}}>
        <DrawerPanel mode="blocking" ariaLabel="Details">
          Content
        </DrawerPanel>
      </OverlayContextProvider>,
      {wrapper}
    );
    expect(await screen.findByText('Content')).toBeInTheDocument();
    expect(
      screen.getByRole('complementary').style.getPropertyValue('--drawer-width')
    ).toBe('100%');
  });

  it('preserves a fixed width when resizing is disabled', async () => {
    render(
      <DrawerPanel
        mode="blocking"
        ariaLabel="Details"
        resizable={false}
        drawerWidth="420px"
      >
        Content
      </DrawerPanel>,
      {wrapper}
    );
    expect(await screen.findByText('Content')).toBeInTheDocument();
    expect(
      screen.getByRole('complementary').style.getPropertyValue('--drawer-width')
    ).toBe('420px');
  });
});
