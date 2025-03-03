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
    render(<Checkbox checked={false} />);

    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('checked', function () {
    render(<Checkbox checked />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('indeterminate', function () {
    render(<Checkbox checked="indeterminate" />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
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
