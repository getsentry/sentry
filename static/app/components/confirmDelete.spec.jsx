import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ConfirmDelete from 'sentry/components/confirmDelete';
import ModalStore from 'sentry/stores/modalStore';

describe('ConfirmDelete', function () {
  afterEach(() => {
    ModalStore.reset();
  });

  it('renders', function () {
    const mock = jest.fn();
    render(
      <ConfirmDelete message="Are you sure?" onConfirm={mock} confirmInput="CoolOrg">
        <button>Confirm?</button>
      </ConfirmDelete>
    );
    const globalModal = renderGlobalModal();
    userEvent.click(screen.getByRole('button'));

    // jest had an issue rendering root component snapshot so using ModalDialog instead
    expect(globalModal.container).toSnapshot();
  });

  it('confirm button is disabled and bypass prop is false when modal opens', function () {
    const mock = jest.fn();
    render(
      <ConfirmDelete message="Are you sure?" onConfirm={mock} confirmInput="CoolOrg">
        <button>Confirm?</button>
      </ConfirmDelete>
    );
    renderGlobalModal();
    userEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('button', {name: 'Confirm'})).toBeDisabled();
  });

  it('confirm button stays disabled with non-matching input', function () {
    const mock = jest.fn();
    render(
      <ConfirmDelete message="Are you sure?" onConfirm={mock} confirmInput="CoolOrg">
        <button>Confirm?</button>
      </ConfirmDelete>
    );
    renderGlobalModal();
    userEvent.click(screen.getByRole('button'));

    userEvent.type(screen.getByPlaceholderText('CoolOrg'), 'Cool');
    expect(screen.getByRole('button', {name: 'Confirm'})).toBeDisabled();
  });

  it('confirm button is enabled when confirm input matches', function () {
    const mock = jest.fn();
    render(
      <ConfirmDelete message="Are you sure?" onConfirm={mock} confirmInput="CoolOrg">
        <button>Confirm?</button>
      </ConfirmDelete>
    );
    renderGlobalModal();
    userEvent.click(screen.getByRole('button'));

    userEvent.type(screen.getByPlaceholderText('CoolOrg'), 'CoolOrg');
    expect(screen.getByRole('button', {name: 'Confirm'})).toBeEnabled();

    userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(mock).toHaveBeenCalled();
    expect(mock.mock.calls).toHaveLength(1);
  });
});
