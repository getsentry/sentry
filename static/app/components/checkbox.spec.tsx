import {useState} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Checkbox from 'sentry/components/checkbox';

describe('Checkbox', function () {
  const defaultProps = {
    checked: false,
    onChange: jest.fn(),
  };

  describe('snapshots', function () {
    it('unchecked state', async function () {
      render(<Checkbox {...defaultProps} />);

      expect(await screen.findByRole('checkbox')).toBeInTheDocument();
    });

    it('checked state', async function () {
      render(<Checkbox {...defaultProps} checked />);

      expect(await screen.findByRole('checkbox')).toBeInTheDocument();
    });

    it('indeterminate state', async function () {
      render(<Checkbox {...defaultProps} checked="indeterminate" />);

      expect(await screen.findByRole('checkbox')).toBeInTheDocument();
    });
  });

  describe('behavior', function () {
    function CheckboxWithLabel() {
      const [checked, setChecked] = useState(false);

      return (
        <label>
          <Checkbox
            checked={checked}
            onChange={e => {
              setChecked(e.target.checked);
            }}
          />
          Label text
        </label>
      );
    }

    it('toggles on click', async function () {
      render(<CheckboxWithLabel />);

      expect(screen.getByRole('checkbox')).not.toBeChecked();
      await userEvent.click(screen.getByLabelText('Label text'));
      expect(screen.getByRole('checkbox')).toBeChecked();
    });
  });
});
