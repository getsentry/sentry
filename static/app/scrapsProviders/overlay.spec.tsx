import {createRef, Fragment} from 'react';

import {
  render,
  screen,
  userEvent,
  waitForDrawerToHide,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {mockMatchMedia} from 'sentry-test/utils';

import {
  DrawerBody,
  useDrawer,
  useDrawerPlacement,
  DrawerHeader,
} from '@sentry/scraps/drawer';
import type {DrawerConfig} from '@sentry/scraps/drawer';

import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {PRIMARY_HEADER_HEIGHT} from 'sentry/views/navigation/constants';

function ExternalWidthControl() {
  const [, setWidth] = useSyncedLocalStorageState(
    'drawer-width:context-storage-sync',
    50
  );
  return <button onClick={() => setWidth(70)}>Set saved width</button>;
}
function GlobalDrawerTestComponent({config}: {config: DrawerConfig}) {
  const {openDrawer, closeDrawer} = useDrawer();
  return (
    <div data-test-id="drawer-test-outside">
      <button
        data-test-id="drawer-test-open"
        onClick={() => openDrawer(config.renderer, config.options)}
      >
        Open
      </button>
      <button data-test-id="drawer-test-close" onClick={closeDrawer}>
        Close
      </button>
    </div>
  );
}

function DrawerPlacement({width, topOffset = 0}: {width: number; topOffset?: number}) {
  useDrawerPlacement({minWidth: width, topOffset});
  return null;
}

describe('GlobalDrawer', () => {
  const ariaLabel = 'drawer-test-aria-label';
  beforeEach(() => {
    jest.resetAllMocks();
    mockMatchMedia(false);
  });

  it('locks document scroll on desktop when opening the drawer', async () => {
    render(
      <GlobalDrawerTestComponent
        config={{
          renderer: () => (
            <DrawerBody data-test-id="drawer-test-content">desktop drawer</DrawerBody>
          ),
          options: {ariaLabel},
        }}
      />
    );

    await userEvent.click(screen.getByTestId('drawer-test-open'));

    expect(await screen.findByTestId('drawer-test-content')).toBeInTheDocument();
    expect(document.body).toHaveStyle({
      position: 'fixed',
      width: '100%',
    });
  });

  it('locks document scroll on mobile when opening the drawer', async () => {
    mockMatchMedia(true);

    render(
      <GlobalDrawerTestComponent
        config={{
          renderer: () => (
            <DrawerBody data-test-id="drawer-test-content">mobile drawer</DrawerBody>
          ),
          options: {ariaLabel},
        }}
      />
    );

    await userEvent.click(screen.getByTestId('drawer-test-open'));

    expect(await screen.findByTestId('drawer-test-content')).toBeInTheDocument();
    expect(document.body).toHaveStyle({
      position: 'fixed',
      width: '100%',
    });
  });

  it('useDrawer hook can open and close the Drawer', async () => {
    render(
      <GlobalDrawerTestComponent
        config={{
          renderer: () => (
            <DrawerBody data-test-id="drawer-test-content">useDrawer hook</DrawerBody>
          ),
          options: {ariaLabel},
        }}
      />
    );

    expect(
      screen.queryByRole('complementary', {name: ariaLabel})
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('drawer-test-open'));

    expect(await screen.findByTestId('drawer-test-content')).toBeInTheDocument();
    expect(screen.getByRole('complementary', {name: ariaLabel})).toBeInTheDocument();
    // Doesn't render header with close button unless provided to renderer
    expect(screen.queryByRole('button', {name: 'Close Drawer'})).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('drawer-test-close'));
    await waitForDrawerToHide(ariaLabel);

    expect(screen.queryByTestId('drawer-test-content')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', {name: ariaLabel})
    ).not.toBeInTheDocument();
  });

  it('closes the drawer on URL change', async () => {
    const {router} = render(
      <GlobalDrawerTestComponent
        config={{
          renderer: () => (
            <DrawerBody data-test-id="drawer-test-content">useDrawer hook</DrawerBody>
          ),

          options: {
            ariaLabel,
            shouldCloseOnLocationChange: location => {
              return !location.pathname.includes('modal');
            },
          },
        }}
      />,
      {initialRouterConfig: {location: {pathname: '/my-modal-view/'}}}
    );

    await userEvent.click(screen.getByTestId('drawer-test-open'));
    expect(await screen.findByTestId('drawer-test-content')).toBeInTheDocument();

    router.navigate('/some-other-path');
    await waitForDrawerToHide(ariaLabel);
    expect(screen.queryByTestId('drawer-test-content')).not.toBeInTheDocument();
  });

  it('calls onClose handler when close button is clicked', async () => {
    const closeSpy = jest.fn();

    render(
      <GlobalDrawerTestComponent
        config={{
          renderer: () => (
            <Fragment>
              <DrawerHeader />
              <DrawerBody data-test-id="drawer-test-content">onClose button</DrawerBody>
            </Fragment>
          ),
          options: {onClose: closeSpy, ariaLabel},
        }}
      />
    );

    await userEvent.click(screen.getByTestId('drawer-test-open'));

    expect(await screen.findByTestId('drawer-test-content')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Close Drawer'}));
    await waitForDrawerToHide(ariaLabel);

    expect(closeSpy).toHaveBeenCalled();
    expect(screen.queryByTestId('drawer-test-content')).not.toBeInTheDocument();
  });

  it('calls onClose handler when clicking outside the drawer', async () => {
    const closeSpy = jest.fn();

    render(
      <GlobalDrawerTestComponent
        config={{
          renderer: () => (
            <DrawerBody data-test-id="drawer-test-content">
              onClose outside click
            </DrawerBody>
          ),
          options: {onClose: closeSpy, ariaLabel},
        }}
      />
    );

    await userEvent.click(screen.getByTestId('drawer-test-open'));

    expect(await screen.findByTestId('drawer-test-content')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('drawer-test-outside'));
    await waitForDrawerToHide(ariaLabel);

    expect(closeSpy).toHaveBeenCalled();
    expect(screen.queryByTestId('drawer-test-content')).not.toBeInTheDocument();
  });

  it('calls onClose handler when closeDrawer prop is called', async () => {
    const closeSpy = jest.fn();

    render(
      <GlobalDrawerTestComponent
        config={{
          renderer: ({closeDrawer: cd}) => (
            <button data-test-id="drawer-test-content" onClick={cd}>
              onClose prop
            </button>
          ),
          options: {onClose: closeSpy, ariaLabel},
        }}
      />
    );

    await userEvent.click(screen.getByTestId('drawer-test-open'));

    const button = screen.getByTestId('drawer-test-content');
    expect(button).toBeInTheDocument();

    await userEvent.click(button);
    await waitForDrawerToHide(ariaLabel);

    expect(closeSpy).toHaveBeenCalled();
    expect(button).not.toBeInTheDocument();
  });

  it('passive mode does not close on outside click', async () => {
    const closeSpy = jest.fn();

    render(
      <GlobalDrawerTestComponent
        config={{
          renderer: () => (
            <Fragment>
              <DrawerHeader />
              <DrawerBody data-test-id="drawer-test-content">passive mode</DrawerBody>
            </Fragment>
          ),
          options: {
            onClose: closeSpy,
            mode: 'passive',
            ariaLabel,
          },
        }}
      />
    );

    await userEvent.click(screen.getByTestId('drawer-test-open'));

    const content = screen.getByTestId('drawer-test-content');

    await userEvent.click(screen.getByTestId('drawer-test-outside'));

    expect(closeSpy).not.toHaveBeenCalled();
    expect(content).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Close Drawer'}));
    await waitForDrawerToHide(ariaLabel);

    expect(closeSpy).toHaveBeenCalled();
    expect(content).not.toBeInTheDocument();
  });

  it('scopes isDrawerOpen to the useDrawer call-site', async () => {
    function ScopedConsumer({label}: {label: string}) {
      const {openDrawer, isDrawerOpen, isAnyDrawerOpen} = useDrawer();
      return (
        <Fragment>
          <button
            data-test-id={`open-${label}`}
            onClick={() =>
              openDrawer(() => <DrawerBody>{label} drawer</DrawerBody>, {
                ariaLabel: `${label}-drawer`,
              })
            }
          >
            Open {label}
          </button>
          <span data-test-id={`is-open-${label}`}>
            {isDrawerOpen ? 'mine' : 'not mine'}
          </span>
          <span data-test-id={`is-any-open-${label}`}>
            {isAnyDrawerOpen ? 'any' : 'none'}
          </span>
        </Fragment>
      );
    }

    render(
      <Fragment>
        <ScopedConsumer label="a" />
        <ScopedConsumer label="b" />
      </Fragment>
    );

    expect(screen.getByTestId('is-open-a')).toHaveTextContent('not mine');
    expect(screen.getByTestId('is-open-b')).toHaveTextContent('not mine');
    expect(screen.getByTestId('is-any-open-a')).toHaveTextContent('none');

    await userEvent.click(screen.getByTestId('open-a'));

    expect(
      await screen.findByRole('complementary', {name: 'a-drawer'})
    ).toBeInTheDocument();
    expect(screen.getByTestId('is-open-a')).toHaveTextContent('mine');
    expect(screen.getByTestId('is-open-b')).toHaveTextContent('not mine');
    expect(screen.getByTestId('is-any-open-a')).toHaveTextContent('any');
    expect(screen.getByTestId('is-any-open-b')).toHaveTextContent('any');
  });

  it('renders custom header content when specified', async () => {
    const closeSpy = jest.fn();
    const customHeader = 'Look at my neat drawer header';
    render(
      <GlobalDrawerTestComponent
        config={{
          renderer: () => (
            <Fragment>
              <DrawerHeader>{customHeader}</DrawerHeader>
              <DrawerBody data-test-id="drawer-test-content">custom header</DrawerBody>
            </Fragment>
          ),
          options: {ariaLabel, onClose: closeSpy},
        }}
      />
    );

    await userEvent.click(screen.getByTestId('drawer-test-open'));

    expect(await screen.findByTestId('drawer-test-content')).toBeInTheDocument();
    const drawer = screen.getByRole('complementary', {name: ariaLabel});
    expect(drawer).toBeInTheDocument();

    // Has close button + custom header
    const closeButton = within(drawer).getByRole('button', {name: 'Close Drawer'});
    expect(closeButton).toBeInTheDocument();
    expect(within(drawer).getByText(customHeader)).toBeInTheDocument();

    await userEvent.click(closeButton);
    await waitForDrawerToHide(ariaLabel);

    expect(closeSpy).toHaveBeenCalled();
    expect(drawer).not.toBeInTheDocument();
  });

  it('applies drawerWidth and drawerMaxWidth as CSS custom properties', async () => {
    render(
      <GlobalDrawerTestComponent
        config={{
          renderer: () => (
            <DrawerBody data-test-id="drawer-test-content">width</DrawerBody>
          ),
          options: {
            ariaLabel,
            drawerKey: 'drawer-test-width',
            drawerWidth: '80%',
            drawerMaxWidth: '1600px',
          },
        }}
      />
    );

    await userEvent.click(screen.getByTestId('drawer-test-open'));
    expect(await screen.findByTestId('drawer-test-content')).toBeInTheDocument();

    const drawer = screen.getByRole('complementary', {name: ariaLabel});

    expect(drawer.style.getPropertyValue('--drawer-width')).toBe('80%');
    expect(drawer.style.getPropertyValue('--drawer-max-width')).toBe('min(85%, 1600px)');
  });

  it('falls back to the default max width when drawerMaxWidth is omitted', async () => {
    render(
      <GlobalDrawerTestComponent
        config={{
          renderer: () => (
            <DrawerBody data-test-id="drawer-test-content">width</DrawerBody>
          ),
          options: {ariaLabel, drawerKey: 'drawer-test-default-width'},
        }}
      />
    );

    await userEvent.click(screen.getByTestId('drawer-test-open'));
    expect(await screen.findByTestId('drawer-test-content')).toBeInTheDocument();

    const drawer = screen.getByRole('complementary', {name: ariaLabel});

    expect(drawer.style.getPropertyValue('--drawer-width')).toBe('50%');
    expect(drawer.style.getPropertyValue('--drawer-max-width')).toBe('85%');
  });

  it.each([
    {width: 420, topOffset: 0},
    {width: 420, topOffset: 44},
    {width: 420, topOffset: 88},
    {width: 0, topOffset: 0},
    {width: 0, topOffset: 45},
  ])(
    'positions a drawer with pane width $width and banner height $topOffset',
    async ({width, topOffset}) => {
      render(
        <Fragment>
          <DrawerPlacement width={width} topOffset={topOffset} />
          <GlobalDrawerTestComponent
            config={{
              renderer: () => (
                <DrawerBody data-test-id="drawer-test-content">docked</DrawerBody>
              ),
              options: {ariaLabel, mode: 'passive'},
            }}
          />
        </Fragment>
      );

      await userEvent.click(screen.getByTestId('drawer-test-open'));
      expect(await screen.findByTestId('drawer-test-content')).toBeInTheDocument();
      const drawer = screen.getByRole('complementary', {name: ariaLabel});
      // The global getComputedStyle stub only reads inline styles. Check the
      // generated rules to verify the panel's placement and minimum width.
      const rules = Array.from(document.styleSheets).flatMap(sheet =>
        Array.from(sheet.cssRules)
      );
      const dockedRule = rules.find(
        rule =>
          rule instanceof CSSStyleRule &&
          drawer.matches(rule.selectorText) &&
          rule.style.getPropertyValue('min-width') === '420px'
      ) as CSSStyleRule | undefined;
      if (width > 0) {
        expect(dockedRule).toBeDefined();
      } else {
        expect(dockedRule).toBeUndefined();
      }
      const panelRules = rules.filter(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule && drawer.matches(rule.selectorText)
      );
      expect(
        panelRules.some(rule => rule.style.getPropertyValue('top') === `${topOffset}px`)
      ).toBe(true);
      expect(
        panelRules.some(
          rule => rule.style.getPropertyValue('height') === `calc(100% - ${topOffset}px)`
        )
      ).toBe(true);

      await userEvent.click(screen.getByTestId('drawer-test-close'));
      await waitForDrawerToHide(ariaLabel);
      expect(
        screen.queryByRole('complementary', {name: ariaLabel})
      ).not.toBeInTheDocument();
    }
  );
  it('keeps the drawer open when a modal portal is clicked', async () => {
    render(
      <GlobalDrawerTestComponent
        config={{
          renderer: () => <DrawerBody>Drawer content</DrawerBody>,
          options: {ariaLabel},
        }}
      />
    );
    await userEvent.click(screen.getByTestId('drawer-test-open'));
    expect(await screen.findByText('Drawer content')).toBeInTheDocument();

    const portal = document.createElement('div');
    portal.id = 'modal-portal';
    const button = document.createElement('button');
    button.textContent = 'Modal action';
    portal.append(button);
    document.body.append(portal);
    try {
      await userEvent.click(button);
      expect(screen.getByRole('complementary', {name: ariaLabel})).toBeInTheDocument();
    } finally {
      portal.remove();
    }
  });

  it('saves keyboard resizing and restores the width when reopened', async () => {
    const key = 'drawer-width:keyboard-persistence';
    localStorage.setItem(key, '50');
    render(
      <GlobalDrawerTestComponent
        config={{
          renderer: () => <DrawerBody>Drawer content</DrawerBody>,
          options: {ariaLabel, drawerKey: 'keyboard-persistence'},
        }}
      />
    );
    await userEvent.click(screen.getByTestId('drawer-test-open'));
    const separator = await screen.findByRole('separator', {name: 'Resize drawer'});
    separator.focus();
    await userEvent.keyboard('{ArrowLeft}');
    const savedWidth = Number(localStorage.getItem(key));
    expect(savedWidth).toBeGreaterThan(50);
    await userEvent.click(screen.getByTestId('drawer-test-close'));
    await waitForDrawerToHide(ariaLabel);
    await userEvent.click(screen.getByTestId('drawer-test-open'));
    expect(await screen.findByText('Drawer content')).toBeInTheDocument();
    expect(
      screen
        .getByRole('complementary', {name: ariaLabel})
        .style.getPropertyValue('--drawer-width')
    ).toBe(`${savedWidth}%`);
    localStorage.removeItem(key);
  });
  it('supplies the app header height to the scraps header', () => {
    const headerRef = createRef<HTMLHeadingElement>();
    render(<DrawerHeader ref={headerRef} />);
    // The app test environment stubs getComputedStyle to return inline styles.
    const rules = Array.from(document.styleSheets).flatMap(sheet =>
      Array.from(sheet.cssRules)
    );
    expect(
      rules.some(
        rule =>
          rule instanceof CSSStyleRule &&
          headerRef.current?.matches(rule.selectorText) &&
          rule.style.getPropertyValue('--drawer-header-height') ===
            PRIMARY_HEADER_HEIGHT + 'px'
      )
    ).toBe(true);
  });
  it('syncs drawer width with the existing app storage hook', async () => {
    const storageKey = 'drawer-width:context-storage-sync';
    localStorage.setItem(storageKey, '50');

    render(
      <Fragment>
        <GlobalDrawerTestComponent
          config={{
            renderer: () => <DrawerBody>Synced content</DrawerBody>,
            options: {ariaLabel, drawerKey: 'context-storage-sync', mode: 'passive'},
          }}
        />
        <ExternalWidthControl />
      </Fragment>
    );
    await userEvent.click(screen.getByTestId('drawer-test-open'));
    expect(await screen.findByText('Synced content')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Set saved width'}));
    await waitFor(() =>
      expect(screen.getByRole('complementary', {name: ariaLabel})).toHaveStyle({
        '--drawer-width': '70%',
      })
    );
    localStorage.removeItem(storageKey);
  });
});
