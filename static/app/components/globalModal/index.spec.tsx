import {
  act,
  renderGlobalModal,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {closeModal, openModal} from 'sentry/actionCreators/modal';
import ModalStore from 'sentry/stores/modalStore';

describe('GlobalModal', function () {
  beforeEach(() => {
    jest.resetAllMocks();
    ModalStore.reset();
  });

  it('uses actionCreators to open and close Modal', async function () {
    renderGlobalModal();

    act(() => openModal(() => <div data-test-id="modal-test">Hi</div>));

    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    act(() => closeModal());

    await waitForElementToBeRemoved(screen.queryByTestId('modal-test'));
    expect(screen.queryByTestId('modal-test')).not.toBeInTheDocument();
  });

  it('calls onClose handler when close button is clicked', async function () {
    renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(
        ({Header}) => (
          <div id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {onClose: closeSpy}
      )
    );

    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));

    expect(closeSpy).toHaveBeenCalled();
  });

  it('calls onClose handler when modal is clicked out of', async function () {
    renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(
        ({Header}) => (
          <div id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {onClose: closeSpy}
      )
    );

    await userEvent.click(screen.getByTestId('modal-backdrop'));

    expect(closeSpy).toHaveBeenCalled();
  });

  it('calls onClose handler when escape key is pressed', async function () {
    renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(
        ({Header}) => (
          <div id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {onClose: closeSpy}
      )
    );

    expect(screen.getByText('Hi')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    expect(closeSpy).toHaveBeenCalled();
  });

  it('calls onClose handler when closeModal prop is called', async function () {
    renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(({closeModal: cm}) => <button onClick={cm}>Yo</button>, {
        onClose: closeSpy,
      })
    );

    await userEvent.click(screen.getByRole('button', {name: 'Yo'}));

    expect(closeSpy).toHaveBeenCalled();
  });

  it("ignores click out with closeEvents: 'escape-key'", async function () {
    const {waitForModalToHide} = renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(
        ({Header}) => (
          <div data-test-id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {closeEvents: 'escape-key', onClose: closeSpy}
      )
    );

    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    // Clicking outside of modal doesn't close
    await userEvent.click(screen.getByTestId('modal-backdrop'));
    expect(screen.getByTestId('modal-test')).toBeInTheDocument();
    expect(closeSpy).not.toHaveBeenCalled();

    // Pressing escape _does_ close
    await userEvent.keyboard('{Escape}');
    await waitForModalToHide();
    expect(closeSpy).toHaveBeenCalled();
  });

  it("ignores escape key with closeEvents: 'backdrop-click'", async function () {
    const {waitForModalToHide} = renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(
        ({Header}) => (
          <div data-test-id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {closeEvents: 'backdrop-click', onClose: closeSpy}
      )
    );

    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    // Pressing escape doesn't close
    await userEvent.keyboard('{Escape}');
    expect(screen.getByTestId('modal-test')).toBeInTheDocument();
    expect(closeSpy).not.toHaveBeenCalled();

    // Clicking outside of modal _does_ close
    await userEvent.click(screen.getByTestId('modal-backdrop'));
    expect(closeSpy).toHaveBeenCalled();
    await waitForModalToHide();
  });

  it("ignores backdrop click and escape key when with closeEvents: 'none'", async function () {
    const {waitForModalToHide} = renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(
        ({Header}) => (
          <div data-test-id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {closeEvents: 'none', onClose: closeSpy}
      )
    );

    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    // Clicking outside of modal doesn't close
    await userEvent.click(screen.getByTestId('modal-backdrop'));
    expect(closeSpy).not.toHaveBeenCalled();

    // Pressing escape doesn't close
    await userEvent.keyboard('{Escape}');
    expect(closeSpy).not.toHaveBeenCalled();

    // Clicking an explicit close button does close
    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));
    expect(closeSpy).toHaveBeenCalled();
    await waitForModalToHide();
  });
});
