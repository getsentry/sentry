import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ConfirmDelete from 'sentry/components/confirmDelete';

describe('ConfirmDelete', () => {
  it('renders', async () => {
    const mock = jest.fn();
    render(
      <ConfirmDelete message="Are you sure?" onConfirm={mock} confirmInput="CoolOrg">
        <button>Confirm?</button>
      </ConfirmDelete>
    );
    renderGlobalModal();
    await userEvent.click(screen.getByRole('button'));
  });

  it('confirm button is disabled and bypass prop is false when modal opens', async () => {
    const mock = jest.fn();
    render(
      <ConfirmDelete message="Are you sure?" onConfirm={mock} confirmInput="CoolOrg">
        <button>Confirm?</button>
      </ConfirmDelete>
    );
    renderGlobalModal();
    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('button', {name: 'Confirm'})).toBeDisabled();
  });

  it('confirm button stays disabled with non-matching input', async () => {
    const mock = jest.fn();
    render(
      <ConfirmDelete message="Are you sure?" onConfirm={mock} confirmInput="CoolOrg">
        <button>Confirm?</button>
      </ConfirmDelete>
    );
    renderGlobalModal();
    await userEvent.click(screen.getByRole('button'));

    await userEvent.type(screen.getByPlaceholderText('CoolOrg'), 'Cool');
    expect(screen.getByRole('button', {name: 'Confirm'})).toBeDisabled();
  });

  it('confirm button is enabled when confirm input matches', async () => {
    const mock = jest.fn();
    render(
      <ConfirmDelete message="Are you sure?" onConfirm={mock} confirmInput="CoolOrg">
        <button>Confirm?</button>
      </ConfirmDelete>
    );
    renderGlobalModal();
    await userEvent.click(screen.getByRole('button'));

    await userEvent.type(screen.getByPlaceholderText('CoolOrg'), 'CoolOrg');
    expect(screen.getByRole('button', {name: 'Confirm'})).toBeEnabled();

    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(mock).toHaveBeenCalled();
    expect(mock.mock.calls).toHaveLength(1);
  });
});
