import {Fragment} from 'react';

import {
  render,
  screen,
  userEvent,
  waitForDrawerToHide,
  within,
} from 'sentry-test/reactTestingLibrary';

import type {DrawerConfig} from 'sentry/components/globalDrawer';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';

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

describe('GlobalDrawer', function () {
  const ariaLabel = 'drawer-test-aria-label';
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('useDrawer hook can open and close the Drawer', async function () {
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

  it('closes the drawer on URL change', async function () {
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
      {disableRouterMocks: true, initialRouterConfig: {location: '/my-modal-view/'}}
    );

    await userEvent.click(screen.getByTestId('drawer-test-open'));
    expect(await screen.findByTestId('drawer-test-content')).toBeInTheDocument();

    router.navigate('/some-other-path');
    await waitForDrawerToHide(ariaLabel);
    expect(screen.queryByTestId('drawer-test-content')).not.toBeInTheDocument();
  });

  it('calls onClose handler when close button is clicked', async function () {
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

  it('calls onClose handler when clicking outside the drawer', async function () {
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

  it('calls onClose handler when closeDrawer prop is called', async function () {
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

  it('ignores some close events press when option is set', async function () {
    const closeSpy = jest.fn();

    render(
      <GlobalDrawerTestComponent
        config={{
          renderer: () => (
            <Fragment>
              <DrawerHeader />
              <DrawerBody data-test-id="drawer-test-content">
                ignore close events
              </DrawerBody>
            </Fragment>
          ),
          options: {
            onClose: closeSpy,
            closeOnEscapeKeypress: false,
            closeOnOutsideClick: false,
            ariaLabel,
          },
        }}
      />
    );

    await userEvent.click(screen.getByTestId('drawer-test-open'));

    const content = screen.getByTestId('drawer-test-content');

    await userEvent.keyboard('{Escape}');

    expect(closeSpy).not.toHaveBeenCalled();
    expect(content).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('drawer-test-outside'));

    expect(closeSpy).not.toHaveBeenCalled();
    expect(content).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Close Drawer'}));
    await waitForDrawerToHide(ariaLabel);

    expect(closeSpy).toHaveBeenCalled();
    expect(content).not.toBeInTheDocument();
  });

  it('renders custom header content when specified', async function () {
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
});
