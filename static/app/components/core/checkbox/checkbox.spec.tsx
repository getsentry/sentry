import {useState} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Checkbox} from '@sentry/scraps/checkbox';

function ControlledCheckbox() {
  const [checked, setChecked] = useState(false);

  return (
    <label>
      <Checkbox checked={checked} onChange={e => setChecked(e.target.checked)} />
      Custom Label
    </label>
  );
}

describe('Checkbox', () => {
  it('default is unchecked', () => {
    render(<Checkbox onChange={jest.fn()} />);

    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('checked', () => {
    render(<Checkbox checked onChange={jest.fn()} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('indeterminate', () => {
    render(<Checkbox checked="indeterminate" onChange={jest.fn()} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole<HTMLInputElement>('checkbox').indeterminate).toBe(true);
  });

  it('uses aria-disabled when a disabled checkbox has a tooltip', async () => {
    const onChange = jest.fn();
    render(
      <label>
        <Checkbox
          disabled
          onChange={onChange}
          tooltipProps={{title: 'Requires admin access'}}
        />
        Enable feature
      </label>
    );

    const checkbox = screen.getByRole('checkbox', {name: 'Enable feature'});
    expect(checkbox).toHaveAttribute('aria-disabled', 'true');
    expect(checkbox).toBeEnabled();

    await userEvent.tab();
    expect(checkbox).toHaveFocus();
    expect(await screen.findByText('Requires admin access')).toBeInTheDocument();
    expect(checkbox).toHaveAccessibleDescription('Requires admin access');

    await userEvent.keyboard(' ');
    expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses native disabled when a disabled checkbox has no tooltip', () => {
    render(<Checkbox disabled aria-label="Enable feature" />);

    expect(screen.getByRole('checkbox', {name: 'Enable feature'})).toBeDisabled();
  });

  describe('controlled checkbox', () => {
    it('toggles on click', async () => {
      render(<ControlledCheckbox />);

      expect(screen.getByRole('checkbox')).not.toBeChecked();
      await userEvent.click(screen.getByLabelText('Custom Label'));
      expect(screen.getByRole('checkbox')).toBeChecked();
    });
  });

  // @TODO(jonasbadalic): Checkbox should support uncontrolled state
});
