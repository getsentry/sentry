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
    render(<Checkbox checked={false} onChange={jest.fn()} />);

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
