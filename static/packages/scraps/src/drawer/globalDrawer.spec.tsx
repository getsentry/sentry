import type * as React from 'react';
import {createRef, Fragment} from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  DrawerBody,
  DrawerHeader,
  GlobalDrawer,
  useDrawer,
  type DrawerOptions,
} from '@sentry/scraps/drawer';
import {lightTheme} from '@sentry/scraps/theme';

const wrapper = ({children}: {children: React.ReactNode}) => (
  <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>
);

function DrawerControl({
  label = 'Details',
  options,
}: {
  label?: string;
  options?: Partial<DrawerOptions>;
}) {
  const {openDrawer, isDrawerOpen, isAnyDrawerOpen} = useDrawer();
  return (
    <Fragment>
      <button
        onClick={() =>
          openDrawer(
            () => (
              <Fragment>
                <DrawerHeader />
                <DrawerBody>{label} content</DrawerBody>
              </Fragment>
            ),
            {ariaLabel: label, ...options}
          )
        }
      >
        Open {label}
      </button>
      <output aria-label={`${label} state`}>
        {isDrawerOpen ? 'mine' : isAnyDrawerOpen ? 'other' : 'closed'}
      </output>
    </Fragment>
  );
}

describe('GlobalDrawer', () => {
  beforeEach(() => {
    jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
  it('opens, locks scrolling, and closes through the header without app providers', async () => {
    const onClose = jest.fn();
    render(
      <GlobalDrawer>
        <DrawerControl options={{onClose}} />
      </GlobalDrawer>,
      {wrapper}
    );
    await userEvent.click(screen.getByRole('button', {name: 'Open Details'}));
    expect(await screen.findByText('Details content')).toBeInTheDocument();
    expect(document.body).toHaveStyle({position: 'fixed'});
    await userEvent.click(screen.getByRole('button', {name: 'Close Drawer'}));
    await waitFor(() =>
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.body).not.toHaveStyle({position: 'fixed'});
  });

  it('keeps open state scoped to the hook caller', async () => {
    render(
      <GlobalDrawer>
        <DrawerControl label="First" />
        <DrawerControl label="Second" />
      </GlobalDrawer>,
      {wrapper}
    );
    await userEvent.click(screen.getByRole('button', {name: 'Open First'}));
    expect(await screen.findByText('First content')).toBeInTheDocument();
    expect(screen.getByLabelText('First state')).toHaveTextContent('mine');
    expect(screen.getByLabelText('Second state')).toHaveTextContent('other');
  });

  it('closes on Escape', async () => {
    render(
      <GlobalDrawer>
        <DrawerControl />
      </GlobalDrawer>,
      {wrapper}
    );
    await userEvent.click(screen.getByRole('button', {name: 'Open Details'}));
    expect(await screen.findByText('Details content')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    );
  });

  it('closes on an outside click', async () => {
    render(
      <GlobalDrawer>
        <DrawerControl />
        <button>Outside</button>
      </GlobalDrawer>,
      {wrapper}
    );
    await userEvent.click(screen.getByRole('button', {name: 'Open Details'}));
    expect(await screen.findByText('Details content')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Outside'}));
    await waitFor(() =>
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    );
  });

  it('keeps passive drawers open during outside interaction and navigation', async () => {
    const {rerender} = render(
      <GlobalDrawer location={{pathname: '/first', query: {}}}>
        <DrawerControl options={{mode: 'passive'}} />
        <button>Outside</button>
      </GlobalDrawer>,
      {wrapper}
    );
    await userEvent.click(screen.getByRole('button', {name: 'Open Details'}));
    expect(await screen.findByText('Details content')).toBeInTheDocument();
    expect(document.body).not.toHaveStyle({position: 'fixed'});
    await userEvent.click(screen.getByRole('button', {name: 'Outside'}));
    rerender(
      <GlobalDrawer location={{pathname: '/second', query: {}}}>
        <DrawerControl options={{mode: 'passive'}} />
        <button>Outside</button>
      </GlobalDrawer>
    );
    expect(screen.getByRole('complementary', {name: 'Details'})).toBeInTheDocument();
  });

  it('uses supplied navigation data without calling onClose', async () => {
    const onClose = jest.fn();
    const {rerender} = render(
      <GlobalDrawer location={{pathname: '/first', query: {}}}>
        <DrawerControl options={{onClose}} />
      </GlobalDrawer>,
      {wrapper}
    );
    await userEvent.click(screen.getByRole('button', {name: 'Open Details'}));
    expect(await screen.findByText('Details content')).toBeInTheDocument();
    rerender(
      <GlobalDrawer location={{pathname: '/second', query: {}}}>
        <DrawerControl options={{onClose}} />
      </GlobalDrawer>
    );
    await waitFor(() =>
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('supplies header height to callers without changing their imports', () => {
    const headerRef = createRef<HTMLHeadingElement>();
    render(
      <GlobalDrawer headerHeight="64px">
        <DrawerHeader ref={headerRef} />
      </GlobalDrawer>,
      {wrapper}
    );
    expect(headerRef.current).toHaveStyle({'--drawer-header-height': '64px'});
  });
  it('resolves an initial width without an app persistence adapter', async () => {
    render(
      <GlobalDrawer>
        <DrawerControl options={{drawerWidth: '70%'}} />
      </GlobalDrawer>,
      {wrapper}
    );
    await userEvent.click(screen.getByRole('button', {name: 'Open Details'}));
    expect(await screen.findByText('Details content')).toBeInTheDocument();
    expect(screen.getByRole('complementary', {name: 'Details'})).toHaveStyle({
      '--drawer-width': '70%',
    });
  });
});
