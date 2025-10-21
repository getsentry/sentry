import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Radio} from 'sentry/components/core/radio';

describe('radio', () => {
  it('disabled', () => {
    render(<Radio disabled />);
    expect(screen.getByRole('radio')).toBeDisabled();
  });

  it('checked', () => {
    render(<Radio checked onChange={jest.fn()} />);
    expect(screen.getByRole('radio')).toBeChecked();
  });

  it('disallows toggling a disabled radio', async () => {
    const onClick = jest.fn();

    render(<Radio disabled onChange={onClick} />);

    const radioButton = screen.getByRole('radio');
    expect(radioButton).not.toBeChecked();

    await userEvent.click(radioButton);
    expect(radioButton).not.toBeChecked();
    expect(onClick).not.toHaveBeenCalled();
  });
});
