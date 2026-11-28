import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DropdownActions} from './dropdownActions';

describe('DropdownActions', () => {
  it('selecting actions calls onAction', async () => {
    const cb = jest.fn();
    render(
      <DropdownActions
        label="Trigger"
        actions={[
          {
            disabled: false,
            key: 'first',
            name: 'Option',
            onAction: cb,
            skipConfirmModal: true,
          },
        ]}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Trigger'}));
    const option = screen.getByRole('option', {name: 'Option'});
    await userEvent.click(option);
    expect(cb).toHaveBeenCalled();
  });

  it('disabled actions cannot be selected', async () => {
    const cb = jest.fn();
    render(
      <DropdownActions
        label="Trigger"
        actions={[{disabled: true, key: 'first', name: 'Disabled Option', onAction: cb}]}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Trigger'}));
    const option = screen.getByRole('option', {name: 'Disabled Option'});
    expect(option).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(option);
    expect(cb).not.toHaveBeenCalled();
  });
});
