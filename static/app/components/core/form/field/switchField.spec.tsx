import {z} from 'zod';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AutoSaveField, defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

interface TestFormProps {
  label: string;
  defaultValue?: boolean;
  disabled?: boolean | string;
  hintText?: string;
  required?: boolean;
  validator?: z.ZodObject<{enabled: z.ZodBoolean}>;
}

function TestForm({
  label,
  hintText,
  required,
  defaultValue = false,
  disabled,
  validator,
}: TestFormProps) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      enabled: defaultValue,
    },
    validators: validator ? {onBlur: validator} : undefined,
  });

  return (
    <form.AppForm>
      <form.AppField name="enabled">
        {field => (
          <field.Layout.Row label={label} hintText={hintText} required={required}>
            <field.Switch
              checked={field.state.value}
              onChange={field.handleChange}
              disabled={disabled}
            />
          </field.Layout.Row>
        )}
      </form.AppField>
    </form.AppForm>
  );
}

const testSchema = z.object({
  enabled: z.boolean(),
});

interface AutoSaveTestFormProps {
  mutationFn: (data: {enabled: boolean}) => Promise<{enabled: boolean}>;
  initialValue?: boolean;
  label?: string;
}

function AutoSaveTestForm({
  mutationFn,
  initialValue = false,
  label = 'Enable Feature',
}: AutoSaveTestFormProps) {
  return (
    <AutoSaveField
      name="enabled"
      schema={testSchema}
      initialValue={initialValue}
      mutationOptions={{mutationFn}}
    >
      {field => (
        <field.Layout.Row label={label}>
          <field.Switch checked={field.state.value} onChange={field.handleChange} />
        </field.Layout.Row>
      )}
    </AutoSaveField>
  );
}

describe('SwitchField', () => {
  it('renders with a label', () => {
    render(<TestForm label="Enable Feature" />);

    expect(screen.getByText('Enable Feature')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('displays checked state correctly', () => {
    render(<TestForm label="Enable Feature" defaultValue />);

    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('displays unchecked state correctly', () => {
    render(<TestForm label="Enable Feature" defaultValue={false} />);

    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('toggles on click', async () => {
    render(<TestForm label="Enable Feature" />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    await userEvent.click(checkbox);

    expect(checkbox).toBeChecked();
  });
});

describe('SwitchField disabled', () => {
  it('is disabled when disabled prop is true', () => {
    render(<TestForm label="Enable Feature" disabled />);

    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('shows tooltip with reason when disabled is a string', async () => {
    render(<TestForm label="Enable Feature" disabled="Feature not available" />);

    expect(screen.getByRole('checkbox')).toBeDisabled();

    // Hover on the switch to trigger tooltip
    await userEvent.hover(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(screen.getByText('Feature not available')).toBeInTheDocument();
    });
  });
});

describe('SwitchField auto-save', () => {
  it('shows spinner when auto-save is pending', async () => {
    const mutationFn = jest.fn(() => new Promise<{enabled: boolean}>(() => {}));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue={false} />);

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    expect(
      await screen.findByRole('status', {name: 'Saving enabled'})
    ).toBeInTheDocument();
    expect(mutationFn).toHaveBeenCalledWith({enabled: true});
  });

  it('shows checkmark when auto-save succeeds', async () => {
    const mutationFn = jest.fn((data: {enabled: boolean}) => Promise.resolve(data));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue={false} />);

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    // Wait for mutation to succeed - there are 2 checkmark icons:
    // one inside the Switch toggle and one as the success indicator
    await waitFor(() => {
      const checkmarks = screen.getAllByTestId('icon-check-mark');
      expect(checkmarks.length).toBeGreaterThan(1);
    });
    expect(mutationFn).toHaveBeenCalledWith({enabled: true});
  });

  it('disables switch while auto-save is pending', async () => {
    const mutationFn = jest.fn(() => new Promise<{enabled: boolean}>(() => {}));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue={false} />);

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    await waitFor(() => {
      expect(checkbox).toBeDisabled();
    });
  });

  it('does not trigger mutation when toggling back to initial value', async () => {
    const mutationFn = jest.fn((data: {enabled: boolean}) => Promise.resolve(data));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue={false} />);

    const checkbox = screen.getByRole('checkbox');
    // Toggle on then off - ends up at initial value
    await userEvent.click(checkbox);
    // First click triggers mutation
    expect(mutationFn).toHaveBeenCalledTimes(1);

    // Clear mock to check next behavior
    mutationFn.mockClear();
    await userEvent.click(checkbox);

    // Second click back to initial value should not trigger mutation
    expect(mutationFn).not.toHaveBeenCalled();
  });
});

describe('SwitchField keyboard navigation', () => {
  it('can be toggled with Space key', async () => {
    render(<TestForm label="Enable Feature" />);

    const checkbox = screen.getByRole('checkbox');
    checkbox.focus();
    expect(checkbox).not.toBeChecked();

    await userEvent.keyboard(' ');

    expect(checkbox).toBeChecked();
  });
});

describe('SwitchField a11y', () => {
  it('focuses the switch when clicking on the label', async () => {
    render(<TestForm label="Enable Feature" />);

    await userEvent.click(screen.getByText('Enable Feature'));

    expect(screen.getByRole('checkbox')).toHaveFocus();
  });

  it('includes required text for screen readers when required is true', () => {
    render(<TestForm label="Enable Feature" required />);

    expect(screen.getByText('(required)')).toBeInTheDocument();
  });

  it('renders hint text', () => {
    render(<TestForm label="Enable Feature" hintText="Toggle to enable this feature" />);

    expect(screen.getByText('Toggle to enable this feature')).toBeInTheDocument();
  });

  it('has aria-invalid false by default', () => {
    render(<TestForm label="Enable Feature" />);

    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'false');
  });
});
