import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import DropdownActions from './dropdownActions';

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

    await userEvent.click(screen.getByText('Trigger'));
    await userEvent.click(screen.getByText('Option'));
    expect(screen.queryByTestId('disabled-icon')).not.toBeInTheDocument();
    expect(cb).toHaveBeenCalled();
  });

  it('disabled actions have an icon', async () => {
    const cb = jest.fn();
    render(
      <DropdownActions
        label="Trigger"
        actions={[{disabled: true, key: 'first', name: 'Disabled Option', onAction: cb}]}
      />
    );

    await userEvent.click(screen.getByText('Trigger'));
    expect(await screen.findByTestId('disabled-icon')).toBeInTheDocument();
  });
});
