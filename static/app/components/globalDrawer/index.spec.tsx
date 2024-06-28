import {
  render,
  screen,
  userEvent,
  waitForDrawerToHide,
} from 'sentry-test/reactTestingLibrary';

import type {DrawerConfig} from 'sentry/components/globalDrawer';
import useDrawer from 'sentry/components/globalDrawer';

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
          renderer: ({Body}) => (
            <Body data-test-id="drawer-test-content">useDrawer hook</Body>
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

    await userEvent.click(screen.getByTestId('drawer-test-close'));
    await waitForDrawerToHide(ariaLabel);

    expect(screen.queryByTestId('drawer-test-content')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', {name: ariaLabel})
    ).not.toBeInTheDocument();
  });

  it('calls onClose handler when close button is clicked', async function () {
    const closeSpy = jest.fn();

    render(
      <GlobalDrawerTestComponent
        config={{
          renderer: ({Body}) => (
            <Body data-test-id="drawer-test-content">onClose button</Body>
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
          renderer: ({Body}) => (
            <Body data-test-id="drawer-test-content">onClose outside click</Body>
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
          renderer: ({Body}) => (
            <Body data-test-id="drawer-test-content">ignore close events</Body>
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
});
