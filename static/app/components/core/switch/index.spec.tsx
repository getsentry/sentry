import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Switch} from 'sentry/components/core/switch';

describe('Switch', () => {
  it('disabled', () => {
    render(<Switch disabled />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('checked', () => {
    render(<Switch checked />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('disallows toggling a disabled switch', async () => {
    const onClick = jest.fn();

    render(<Switch disabled onClick={onClick} />);

    const switchButton = screen.getByRole('checkbox');
    expect(switchButton).not.toBeChecked();

    await userEvent.click(switchButton);
    expect(switchButton).not.toBeChecked();
    expect(onClick).not.toHaveBeenCalled();
  });
});
