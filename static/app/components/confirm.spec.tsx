import {
  act,
  createEvent,
  fireEvent,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import Confirm from 'sentry/components/confirm';
import ModalStore from 'sentry/stores/modalStore';

describe('Confirm', function () {
  beforeEach(() => {
    jest.useRealTimers();
  });
  afterEach(() => {
    ModalStore.reset();
  });

  it('renders', function () {
    const mock = jest.fn();
    render(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>
    );
  });

  it('renders custom confirm button & callbacks work', async function () {
    const mock = jest.fn();
    render(
      <Confirm
        message="Are you sure?"
        onConfirm={mock}
        renderConfirmButton={({defaultOnClick}) => (
          <button data-test-id="confirm-btn" onClick={defaultOnClick}>
            Confirm Button
          </button>
        )}
      >
        <button data-test-id="trigger-btn">Confirm?</button>
      </Confirm>
    );
    renderGlobalModal();
    await userEvent.click(screen.getByTestId('trigger-btn'));

    const confirmBtn = screen.getByTestId('confirm-btn');
    expect(confirmBtn).toBeInTheDocument();

    expect(mock).not.toHaveBeenCalled();
    await userEvent.click(confirmBtn);
    expect(mock).toHaveBeenCalled();
  });
  it('renders custom cancel button & callbacks work', async function () {
    const mock = jest.fn();
    render(
      <Confirm
        message="Are you sure?"
        onCancel={mock}
        renderCancelButton={({defaultOnClick}) => (
          <button data-test-id="cancel-btn" onClick={defaultOnClick}>
            Cancel Button
          </button>
        )}
      >
        <button data-test-id="trigger-btn">Confirm?</button>
      </Confirm>
    );
    renderGlobalModal();
    await userEvent.click(screen.getByTestId('trigger-btn'));

    const cancelBtn = screen.getByTestId('cancel-btn');
    expect(cancelBtn).toBeInTheDocument();

    expect(mock).not.toHaveBeenCalled();
    await userEvent.click(cancelBtn);
    expect(mock).toHaveBeenCalled();
  });
  it('clicking action button opens Modal', async function () {
    const mock = jest.fn();
    render(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>
    );
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('clicks Confirm in modal and calls `onConfirm` callback', async function () {
    const mock = jest.fn();
    render(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>
    );
    const {waitForModalToHide} = renderGlobalModal();

    expect(mock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: 'Confirm?'}));

    // Click "Confirm" button, should be last button
    await userEvent.click(screen.getByText('Confirm'));
    await waitForModalToHide();

    expect(mock).toHaveBeenCalled();
    expect(mock.mock.calls).toHaveLength(1);
  });

  it('can stop propagation on the event', function () {
    const mock = jest.fn();
    render(
      <Confirm message="Are you sure?" onConfirm={mock} stopPropagation>
        <button>Confirm?</button>
      </Confirm>
    );

    expect(mock).not.toHaveBeenCalled();

    const button = screen.getByRole('button');
    const clickEvent = createEvent.click(button);
    clickEvent.stopPropagation = jest.fn();

    fireEvent(button, clickEvent);
    expect(clickEvent.stopPropagation).toHaveBeenCalled();
  });

  describe('async onConfirm', function () {
    it('should not close the modal until the promise is resolved', async function () {
      jest.useFakeTimers();
      const onConfirmAsync = jest.fn().mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(resolve, 1000);
          })
      );

      render(
        <Confirm message="Are you sure?" onConfirm={onConfirmAsync}>
          <button>Confirm?</button>
        </Confirm>
      );
      renderGlobalModal();

      await userEvent.click(screen.getByRole('button', {name: 'Confirm?'}), {
        delay: null,
      });

      await screen.findByRole('dialog');

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}), {
        delay: null,
      });

      // Should keep modal in view until the promise is resolved
      expect(onConfirmAsync).toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      act(() => jest.runAllTimers());

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('displays an error message if the promise is rejected', async function () {
      jest.useFakeTimers();
      const onConfirmAsync = jest.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(reject, 1000);
          })
      );

      render(
        <Confirm message="Are you sure?" onConfirm={onConfirmAsync}>
          <button>Confirm?</button>
        </Confirm>
      );
      renderGlobalModal();

      await userEvent.click(screen.getByRole('button', {name: 'Confirm?'}), {
        delay: null,
      });

      await screen.findByRole('dialog');

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}), {
        delay: null,
      });

      // Should keep modal in view until the promise is resolved
      expect(onConfirmAsync).toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      act(() => jest.runAllTimers());

      // Should show error message and not close the modal
      await screen.findByText(/something went wrong/i);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Confirm'})).toBeEnabled();
    });
  });
});
