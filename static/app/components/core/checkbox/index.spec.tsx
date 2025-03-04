import {useState} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Checkbox} from 'sentry/components/core/checkbox';

function ControlledCheckbox() {
  const [checked, setChecked] = useState(false);

  return (
    <label>
      <Checkbox checked={checked} onChange={e => setChecked(e.target.checked)} />
      Custom Label
    </label>
  );
}

describe('Checkbox', function () {
  it('default is unchecked', function () {
    render(<Checkbox checked={false} onChange={jest.fn()} />);

    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('checked', function () {
    render(<Checkbox checked onChange={jest.fn()} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('indeterminate', function () {
    render(<Checkbox checked="indeterminate" onChange={jest.fn()} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect((screen.getByRole('checkbox') as HTMLInputElement).indeterminate).toBe(true);
  });

  describe('controlled checkbox', function () {
    it('toggles on click', async function () {
      render(<ControlledCheckbox />);

      expect(screen.getByRole('checkbox')).not.toBeChecked();
      await userEvent.click(screen.getByLabelText('Custom Label'));
      expect(screen.getByRole('checkbox')).toBeChecked();
    });
  });

  // @TODO(jonasbadalic): Checkbox should support uncontrolled state
});
