import {
  act,
  renderGlobalDrawer,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {closeDrawer, openDrawer} from 'sentry/actionCreators/drawer';
import DrawerStore from 'sentry/stores/drawerStore';

describe('GlobalDrawer', function () {
  beforeEach(() => {
    jest.resetAllMocks();
    DrawerStore.reset();
  });

  it('uses actionCreators to open and close the Drawer', function () {
    renderGlobalDrawer();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();

    act(() =>
      openDrawer(({Body}) => <Body data-test-id="drawer-test">actionCreators</Body>)
    );

    expect(screen.getByTestId('drawer-test')).toBeInTheDocument();
    expect(screen.getByRole('complementary')).toBeVisible();

    act(() => closeDrawer());

    expect(screen.queryByTestId('drawer-test')).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('calls onClose handler when close button is clicked', async function () {
    renderGlobalDrawer();
    const closeSpy = jest.fn();

    act(() =>
      openDrawer(({Body}) => <Body data-test-id="drawer-test">onClose button</Body>, {
        onClose: closeSpy,
      })
    );

    const content = screen.getByText('onClose button');
    expect(content).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Close Drawer'}));

    expect(closeSpy).toHaveBeenCalled();
    await waitForElementToBeRemoved(content);
    expect(screen.queryByText('onClose button')).not.toBeInTheDocument();
  });

  it('calls onClose handler when clicking outside the drawer', async function () {
    renderGlobalDrawer();
    const closeSpy = jest.fn();

    act(() =>
      openDrawer(
        ({Body}) => <Body data-test-id="drawer-test">onClose outside click</Body>,
        {
          onClose: closeSpy,
        }
      )
    );

    const content = screen.getByText('onClose outside click');
    expect(content).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('drawer-container'));

    expect(closeSpy).toHaveBeenCalled();
    await waitForElementToBeRemoved(content);
    expect(screen.queryByText('onClose outside click')).not.toBeInTheDocument();
  });

  it('calls onClose handler when escape key is pressed', async function () {
    renderGlobalDrawer();
    const closeSpy = jest.fn();

    act(() =>
      openDrawer(({Body}) => <Body data-test-id="drawer-test">onClose escape</Body>, {
        onClose: closeSpy,
      })
    );

    const content = screen.getByText('onClose escape');
    expect(content).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(closeSpy).toHaveBeenCalled();
    expect(screen.queryByText('onClose escape')).not.toBeInTheDocument();
  });

  it('calls onClose handler when closeDrawer prop is called', async function () {
    renderGlobalDrawer();
    const closeSpy = jest.fn();

    act(() =>
      openDrawer(({closeDrawer: cd}) => <button onClick={cd}>onClose prop</button>, {
        onClose: closeSpy,
      })
    );

    const button = screen.getByRole('button', {name: 'onClose prop'});
    expect(button).toBeInTheDocument();

    await userEvent.click(button);

    expect(closeSpy).toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: 'onClose prop'})).not.toBeInTheDocument();
  });

  it('ignores some close events press when option is set', async function () {
    renderGlobalDrawer();
    const closeSpy = jest.fn();

    act(() =>
      openDrawer(
        ({Body}) => <Body data-test-id="drawer-test">ignore close events</Body>,
        {
          onClose: closeSpy,
          closeOnEscapeKeypress: false,
          closeOnOutsideClick: false,
        }
      )
    );

    const content = screen.getByText('ignore close events');
    expect(content).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(closeSpy).not.toHaveBeenCalled();
    expect(content).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('drawer-container'));

    expect(closeSpy).not.toHaveBeenCalled();
    expect(content).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Close Drawer'}));

    expect(closeSpy).toHaveBeenCalled();
    await waitForElementToBeRemoved(content);
    expect(screen.queryByText('ignore close events')).not.toBeInTheDocument();
  });
});
