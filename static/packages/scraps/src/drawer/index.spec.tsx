import type * as React from 'react';
import {createRef} from 'react';
import {ThemeProvider} from '@emotion/react';
import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {DrawerBody, DrawerHeader, DrawerPanel} from '@sentry/scraps/drawer';
import {OverlayContextProvider} from '@sentry/scraps/overlayContext';
import {lightTheme} from '@sentry/scraps/theme';

import {dragHandle, dragMove} from '../../test/dragMove';

const wrapper = ({children}: {children: React.ReactNode}) => (
  <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>
);

describe('DrawerPanel', () => {
  it('renders without app providers and connects its close button and ref', async () => {
    const onClose = jest.fn();
    const ref = createRef<HTMLDivElement>();
    render(
      <DrawerPanel ref={ref} mode="blocking" ariaLabel="Details" onClose={onClose}>
        <DrawerHeader height="64px">Details</DrawerHeader>
        <DrawerBody>Content</DrawerBody>
      </DrawerPanel>,
      {wrapper}
    );

    expect(await screen.findByText('Content')).toBeInTheDocument();
    expect(ref.current).toBe(screen.getByRole('complementary', {name: 'Details'}));
    await userEvent.click(screen.getByRole('button', {name: 'Close Drawer'}));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('resizes with the keyboard and keeps focus on the separator', async () => {
    const onWidthChange = jest.fn();
    render(
      <DrawerPanel mode="blocking" ariaLabel="Details" onWidthChange={onWidthChange}>
        Content
      </DrawerPanel>,
      {wrapper}
    );
    const separator = await screen.findByRole('separator', {name: 'Resize drawer'});
    separator.focus();
    await userEvent.keyboard('{ArrowLeft}');

    expect(onWidthChange).toHaveBeenCalledWith(50 + (10 / window.innerWidth) * 100);
    expect(separator).toHaveFocus();
  });

  it.each([
    {to: -2000, expected: 85},
    {to: 2000, expected: 20},
  ])('clamps pointer resizing to $expected percent', async ({to, expected}) => {
    const onWidthChange = jest.fn();
    render(
      <DrawerPanel mode="blocking" ariaLabel="Details" onWidthChange={onWidthChange}>
        Content
      </DrawerPanel>,
      {wrapper}
    );
    const separator = await screen.findByRole('separator', {name: 'Resize drawer'});
    dragHandle(separator, {from: 500, to});

    await waitFor(() => expect(onWidthChange).toHaveBeenCalledWith(expected));
    expect(screen.getByRole('complementary')).not.toHaveAttribute('data-resizing');
  });

  it('cleans up an active drag on unmount', async () => {
    const onWidthChange = jest.fn();
    const {unmount} = render(
      <DrawerPanel mode="blocking" ariaLabel="Details" onWidthChange={onWidthChange}>
        Content
      </DrawerPanel>,
      {wrapper}
    );
    const separator = await screen.findByRole('separator', {name: 'Resize drawer'});
    dragHandle(separator, {from: 500, to: 400, release: false});
    expect(document.body).toHaveStyle({pointerEvents: 'none'});
    unmount();
    dragMove({to: 200});
    expect(document.body).toHaveStyle({pointerEvents: ''});
    // Check the inline reset; the computed default cursor is 'auto'.
    // eslint-disable-next-line jest-dom/prefer-to-have-style
    expect(document.documentElement.style.cursor).toBe('');
    expect(onWidthChange).not.toHaveBeenCalled();
  });

  it('ends a cancelled pointer drag and clears its resize state', async () => {
    render(
      <DrawerPanel mode="blocking" ariaLabel="Details">
        Content
      </DrawerPanel>,
      {wrapper}
    );
    const separator = await screen.findByRole('separator', {name: 'Resize drawer'});
    dragHandle(separator, {from: 500, to: 400, release: false});
    act(() => {
      window.dispatchEvent(new PointerEvent('pointercancel', {pointerId: 1}));
    });
    expect(screen.getByRole('complementary')).not.toHaveAttribute('data-resizing');
  });

  it('uses full width and hides resizing on small screens', async () => {
    render(
      <OverlayContextProvider value={{isSmallScreen: true}}>
        <DrawerPanel mode="blocking" ariaLabel="Details">
          Content
        </DrawerPanel>
      </OverlayContextProvider>,
      {wrapper}
    );
    expect(await screen.findByText('Content')).toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
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
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(
      screen.getByRole('complementary').style.getPropertyValue('--drawer-width')
    ).toBe('420px');
  });
});
