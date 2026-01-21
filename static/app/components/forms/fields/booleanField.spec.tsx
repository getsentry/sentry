import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import BooleanField from 'sentry/components/forms/fields/booleanField';
import Form from 'sentry/components/forms/form';

describe('BooleanField', () => {
  it('renders without form context', () => {
    render(<BooleanField name="fieldName" />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('renders with form context', () => {
    render(
      <Form initialData={{fieldName: true}}>
        <BooleanField name="fieldName" />
      </Form>
    );
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('toggles on and off', async () => {
    const onChange = jest.fn();
    render(<BooleanField name="fieldName" onChange={onChange} />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    await userEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(true, expect.anything());
  });

  it('starts with initial value of true', () => {
    render(<BooleanField name="fieldName" value />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('starts with initial value of false', () => {
    render(<BooleanField name="fieldName" value={false} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('coerces truthy values to boolean', () => {
    render(<BooleanField name="fieldName" value="truthy string" />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('coerces falsy values to boolean', () => {
    render(<BooleanField name="fieldName" value="" />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('shows disabled state', () => {
    render(<BooleanField name="fieldName" disabled />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('shows disabled reason in tooltip', async () => {
    render(<BooleanField name="fieldName" disabled disabledReason="Not allowed" />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();

    await userEvent.hover(checkbox);
    await waitFor(() => {
      expect(screen.getByText('Not allowed')).toBeInTheDocument();
    });
  });

  describe('with confirm prop', () => {
    it('skips confirm dialog when no message for current state', async () => {
      const onChange = jest.fn();
      const confirm = {
        true: 'Are you sure you want to enable this?',
      };

      render(
        <BooleanField name="fieldName" value onChange={onChange} confirm={confirm} />
      );

      // Clicking to disable (false state) - no confirm message for false
      await userEvent.click(screen.getByRole('checkbox'));

      // Should call onChange immediately without showing dialog
      expect(onChange).toHaveBeenCalled();
    });

    it('calls change immediately when no confirm message defined', async () => {
      const onChange = jest.fn();

      render(<BooleanField name="fieldName" onChange={onChange} />);

      await userEvent.click(screen.getByRole('checkbox'));

      // Should call onChange immediately
      expect(onChange).toHaveBeenCalledWith(true, expect.anything());
    });
  });

  it('calls both onChange and onBlur when toggled', async () => {
    const onChange = jest.fn();
    const onBlur = jest.fn();

    render(<BooleanField name="fieldName" onChange={onChange} onBlur={onBlur} />);

    await userEvent.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledWith(true, expect.anything());
    expect(onBlur).toHaveBeenCalledWith(true, expect.anything());
  });
});
