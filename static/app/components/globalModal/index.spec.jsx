import {
  act,
  render,
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

  it('calls onClose handler when modal is clicked out of', function () {
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

    userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));

    expect(closeSpy).toHaveBeenCalled();
  });

  it('calls onClose handler when escape key is pressed', function () {
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
    userEvent.keyboard('{Escape}');

    expect(closeSpy).toHaveBeenCalled();
  });

  it('calls onClose handler when closeModal prop is called', function () {
    renderGlobalModal();
    const closeSpy = jest.fn();

    act(() =>
      openModal(({closeModal: cm}) => <button onClick={cm}>Yo</button>, {
        onClose: closeSpy,
      })
    );

    userEvent.click(screen.getByRole('button', {name: 'Yo'}));

    expect(closeSpy).toHaveBeenCalled();
  });

  it("ignores click out with backdrop: 'static'", async function () {
    const {waitForModalToHide} = renderGlobalModal();
    render(<div data-test-id="outside-test">Hello</div>);

    act(() =>
      openModal(
        ({Header}) => (
          <div data-test-id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {backdrop: 'static'}
      )
    );

    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    // Clicking outside of modal doesn't close
    userEvent.click(screen.getByTestId('outside-test'));
    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    // Pressing escape _does_ close
    userEvent.keyboard('{Escape}');
    expect(screen.getByTestId('modal-test')).toBeInTheDocument();
    await waitForModalToHide();
  });

  it("ignores click out with preventClose: 'backdrop-click'", async function () {
    const {waitForModalToHide} = renderGlobalModal();
    render(<div data-test-id="outside-test">Hello</div>);

    act(() =>
      openModal(
        ({Header}) => (
          <div data-test-id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {preventClose: 'backdrop-click'}
      )
    );

    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    // Clicking outside of modal doesn't close
    userEvent.click(screen.getByTestId('outside-test'));
    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    // Pressing escape _does_ close
    userEvent.keyboard('{Escape}');
    expect(screen.getByTestId('modal-test')).toBeInTheDocument();
    await waitForModalToHide();
  });

  it("ignores backdrop click and escape key when with preventClose: 'always'", async function () {
    const {waitForModalToHide} = renderGlobalModal();
    render(<div data-test-id="outside-test">Hello</div>);

    act(() =>
      openModal(
        ({Header}) => (
          <div data-test-id="modal-test">
            <Header closeButton>Header</Header>Hi
          </div>
        ),
        {preventClose: 'always'}
      )
    );

    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    // Clicking outside of modal doesn't close
    userEvent.click(screen.getByTestId('outside-test'));
    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    // Pressing escape doesn't close
    userEvent.keyboard('{Escape}');
    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));

    await waitForModalToHide();
  });
});
