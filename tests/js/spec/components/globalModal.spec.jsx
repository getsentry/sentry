import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {closeModal, openModal} from 'sentry/actionCreators/modal';
import GlobalModal from 'sentry/components/globalModal';
import ModalStore from 'sentry/stores/modalStore';

describe('GlobalModal', function () {
  beforeEach(() => {
    ModalStore.reset();
  });
  afterEach(() => {
    ModalStore.teardown();
  });

  it('uses actionCreators to open and close Modal', async function () {
    renderGlobalModal();

    openModal(() => <div data-test-id="modal-test">Hi</div>);

    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    closeModal();

    await waitForElementToBeRemoved(screen.queryByTestId('modal-test'));
    expect(screen.queryByTestId('modal-test')).not.toBeInTheDocument();
  });

  it('calls onClose handler when modal is clicked out of', function () {
    render(<GlobalModal />);
    const closeSpy = jest.fn();

    openModal(
      ({Header}) => (
        <div id="modal-test">
          <Header closeButton>Header</Header>Hi
        </div>
      ),
      {onClose: closeSpy}
    );

    userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));

    expect(closeSpy).toHaveBeenCalled();
  });

  it('calls onClose handler when closeModal prop is called', function () {
    render(<GlobalModal />);
    const closeSpy = jest.fn();

    openModal(({closeModal: cm}) => <button onClick={cm}>Yo</button>, {
      onClose: closeSpy,
    });

    userEvent.click(screen.getByRole('button', {name: 'Yo'}));

    expect(closeSpy).toHaveBeenCalled();
  });

  it('calls ignores click out when the allowClickClose option is false', async function () {
    render(
      <div>
        <div data-test-id="outside-test">Hello</div>
        <GlobalModal />
      </div>
    );

    openModal(
      ({Header}) => (
        <div data-test-id="modal-test">
          <Header closeButton>Header</Header>Hi
        </div>
      ),
      {allowClickClose: false}
    );

    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    userEvent.click(screen.getByTestId('outside-test'));

    expect(screen.getByTestId('modal-test')).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));

    await waitForElementToBeRemoved(screen.queryByTestId('modal-test'));
    expect(screen.queryByTestId('modal-test')).not.toBeInTheDocument();
  });
});
