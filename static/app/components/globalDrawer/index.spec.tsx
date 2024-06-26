import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import useDrawer, {type DrawerConfig} from 'sentry/components/globalDrawer/context';

function GlobalDrawerTestComponent({config}: {config: DrawerConfig}) {
  const {openDrawer, closeDrawer} = useDrawer();
  return (
    <div>
      <button
        data-test-id="test-open-drawer"
        onClick={() => openDrawer(config.renderer, config.options)}
      >
        Open
      </button>
      <button data-test-id="test-close-drawer" onClick={closeDrawer}>
        Close
      </button>
    </div>
  );
}

describe('GlobalDrawer', function () {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('useDrawer hook can open and close the Drawer', async function () {
    render(
      <GlobalDrawerTestComponent
        config={{
          renderer: ({Body}) => <Body data-test-id="drawer-test">useDrawer hook</Body>,
        }}
      />
    );

    // It is present, but ignored when `aria-hidden` is set to True
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('test-open-drawer'));

    expect(await screen.findByTestId('drawer-test')).toBeInTheDocument();
    expect(screen.getByRole('complementary')).toBeVisible();

    await userEvent.click(screen.getByTestId('test-close-drawer'));

    waitForElementToBeRemoved(screen.getByTestId('drawer-test'));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('calls onClose handler when close button is clicked', async function () {
    const closeSpy = jest.fn();

    render(
      <GlobalDrawerTestComponent
        config={{
          renderer: ({Body}) => <Body data-test-id="drawer-test">onClose button</Body>,
          options: {onClose: closeSpy},
        }}
      />
    );

    await userEvent.click(screen.getByTestId('test-open-drawer'));

    expect(await screen.findByTestId('drawer-test')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('close-drawer-control'));

    expect(closeSpy).toHaveBeenCalled();
    await waitForElementToBeRemoved(screen.getByTestId('drawer-test'));
  });

  it('calls onClose handler when clicking outside the drawer', async function () {
    const closeSpy = jest.fn();

    render(
      <GlobalDrawerTestComponent
        config={{
          renderer: ({Body}) => (
            <Body data-test-id="drawer-test">onClose outside click</Body>
          ),
          options: {onClose: closeSpy},
        }}
      />
    );

    await userEvent.click(screen.getByTestId('test-open-drawer'));

    expect(await screen.findByTestId('drawer-test')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('drawer-container'));

    expect(closeSpy).toHaveBeenCalled();
    await waitForElementToBeRemoved(screen.getByTestId('drawer-test'));
  });

  it('calls onClose handler when escape key is pressed', async function () {
    const closeSpy = jest.fn();

    render(
      <GlobalDrawerTestComponent
        config={{
          renderer: ({Body}) => <Body data-test-id="drawer-test">onClose escape</Body>,
          options: {onClose: closeSpy},
        }}
      />
    );

    await userEvent.click(screen.getByTestId('test-open-drawer'));

    const content = screen.getByTestId('drawer-test');
    expect(content).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(closeSpy).toHaveBeenCalled();
    await waitForElementToBeRemoved(content);
  });

  it('calls onClose handler when closeDrawer prop is called', async function () {
    const closeSpy = jest.fn();

    render(
      <GlobalDrawerTestComponent
        config={{
          renderer: ({closeDrawer: cd}) => (
            <button data-test-id="drawer-test" onClick={cd}>
              onClose prop
            </button>
          ),
          options: {onClose: closeSpy},
        }}
      />
    );

    await userEvent.click(screen.getByTestId('test-open-drawer'));

    const button = screen.getByTestId('drawer-test');
    expect(button).toBeInTheDocument();

    await userEvent.click(button);

    expect(closeSpy).toHaveBeenCalled();
    expect(button).not.toBeInTheDocument();
  });

  it('ignores some close events press when option is set', async function () {
    const closeSpy = jest.fn();

    render(
      <GlobalDrawerTestComponent
        config={{
          renderer: ({Body}) => (
            <Body data-test-id="drawer-test">ignore close events</Body>
          ),
          options: {
            onClose: closeSpy,
            closeOnEscapeKeypress: false,
            closeOnOutsideClick: false,
          },
        }}
      />
    );

    await userEvent.click(screen.getByTestId('test-open-drawer'));

    const content = screen.getByTestId('drawer-test');

    await userEvent.keyboard('{Escape}');

    expect(closeSpy).not.toHaveBeenCalled();
    expect(content).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('drawer-container'));

    expect(closeSpy).not.toHaveBeenCalled();
    expect(content).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('close-drawer-control'));

    expect(closeSpy).toHaveBeenCalled();
    await waitForElementToBeRemoved(content);
  });
});
