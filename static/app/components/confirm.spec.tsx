import {
  createEvent,
  fireEvent,
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import Confirm from 'sentry/components/confirm';
import ModalStore from 'sentry/stores/modalStore';

describe('Confirm', function () {
  afterEach(() => {
    ModalStore.reset();
  });

  it('renders', function () {
    const mock = jest.fn();
    const wrapper = render(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>
    );

    expect(wrapper.container).toSnapshot();
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
    renderGlobalModal();

    expect(mock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button'));

    // Click "Confirm" button, should be last button
    await userEvent.click(screen.getByText('Confirm'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
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
});
