import {z} from 'zod';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AutoSaveField, defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

interface TestFormProps {
  label: string;
  defaultValue?: string;
  disabled?: boolean | string;
  hintText?: string;
  required?: boolean;
}

function TestForm({
  label,
  hintText,
  required,
  defaultValue = 'low',
  disabled,
}: TestFormProps) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      priority: defaultValue,
    },
  });

  return (
    <form.AppForm form={form}>
      <form.AppField name="priority">
        {field => (
          <field.Radio.Group
            value={field.state.value}
            onChange={field.handleChange}
            disabled={disabled}
          >
            <field.Layout.Row label={label} hintText={hintText} required={required}>
              <field.Radio.Item value="low">Low</field.Radio.Item>
              <field.Radio.Item value="medium">Medium</field.Radio.Item>
              <field.Radio.Item value="high" description="Urgent issues">
                High
              </field.Radio.Item>
            </field.Layout.Row>
          </field.Radio.Group>
        )}
      </form.AppField>
    </form.AppForm>
  );
}

const testSchema = z.object({
  priority: z.string(),
});

interface AutoSaveTestFormProps {
  mutationFn: (data: {priority: string}) => Promise<{priority: string}>;
  initialValue?: string;
  label?: string;
  onError?: (error: Error) => void;
}

function AutoSaveTestForm({
  mutationFn,
  initialValue = 'low',
  label = 'Priority',
  onError,
}: AutoSaveTestFormProps) {
  return (
    <AutoSaveField
      name="priority"
      schema={testSchema}
      initialValue={initialValue}
      mutationOptions={{mutationFn, onError}}
    >
      {field => (
        <field.Radio.Group value={field.state.value} onChange={field.handleChange}>
          <field.Layout.Row label={label}>
            <field.Radio.Item value="low">Low</field.Radio.Item>
            <field.Radio.Item value="medium">Medium</field.Radio.Item>
            <field.Radio.Item value="high">High</field.Radio.Item>
          </field.Layout.Row>
        </field.Radio.Group>
      )}
    </AutoSaveField>
  );
}

describe('RadioField', () => {
  it('renders with options', () => {
    render(<TestForm label="Priority" />);

    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('displays selected value', () => {
    render(<TestForm label="Priority" defaultValue="medium" />);

    const radios = screen.getAllByRole('radio');
    expect(radios[0]).not.toBeChecked(); // low
    expect(radios[1]).toBeChecked(); // medium
    expect(radios[2]).not.toBeChecked(); // high
  });

  it('changes value on click', async () => {
    render(<TestForm label="Priority" defaultValue="low" />);

    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toBeChecked(); // low initially

    await userEvent.click(radios[2]!); // click high

    expect(radios[0]).not.toBeChecked();
    expect(radios[2]!).toBeChecked();
  });

  it('renders options with descriptions', () => {
    render(<TestForm label="Priority" />);

    expect(screen.getByText('Urgent issues')).toBeInTheDocument();
  });

  it('renders as radiogroup with associated label as text', () => {
    render(<TestForm label="Priority" />);

    expect(screen.getByRole('radiogroup', {name: 'Priority'})).toBeInTheDocument();
  });
});

describe('RadioField disabled', () => {
  it('is disabled when disabled prop is true', () => {
    render(<TestForm label="Priority" disabled />);

    const radios = screen.getAllByRole('radio');
    radios.forEach(radio => {
      expect(radio).toBeDisabled();
    });
  });

  it('shows tooltip with reason when disabled is a string', async () => {
    render(<TestForm label="Priority" disabled="Feature not available" />);

    const radios = screen.getAllByRole('radio');
    radios.forEach(radio => {
      expect(radio).toBeDisabled();
    });

    // Hover on the radio group to trigger tooltip
    await userEvent.hover(screen.getByRole('radiogroup'));

    await waitFor(() => {
      expect(screen.getByText('Feature not available')).toBeInTheDocument();
    });
  });
});

describe('RadioField auto-save', () => {
  it('shows spinner when auto-save is pending', async () => {
    const mutationFn = jest.fn(() => new Promise<{priority: string}>(() => {}));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue="low" />);

    const radios = screen.getAllByRole('radio');
    await userEvent.click(radios[2]!); // click high

    expect(
      await screen.findByRole('status', {name: 'Saving priority'})
    ).toBeInTheDocument();
    expect(mutationFn).toHaveBeenCalledWith({priority: 'high'});
  });

  it('shows checkmark when auto-save succeeds', async () => {
    const mutationFn = jest.fn((data: {priority: string}) => Promise.resolve(data));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue="low" />);

    const radios = screen.getAllByRole('radio');
    await userEvent.click(radios[2]!); // click high

    expect(await screen.findByTestId('icon-check-mark')).toBeInTheDocument();
    expect(mutationFn).toHaveBeenCalledWith({priority: 'high'});
  });

  it('disables radios while auto-save is pending', async () => {
    const mutationFn = jest.fn(() => new Promise<{priority: string}>(() => {}));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue="low" />);

    const radios = screen.getAllByRole('radio');
    await userEvent.click(radios[2]!); // click high

    await waitFor(() => {
      radios.forEach(radio => {
        expect(radio).toBeDisabled();
      });
    });
  });

  it('does not trigger mutation when selecting same value', async () => {
    const mutationFn = jest.fn((data: {priority: string}) => Promise.resolve(data));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue="low" />);

    const radios = screen.getAllByRole('radio');
    // Click the already selected option
    await userEvent.click(radios[0]!); // low is already selected

    // Should not trigger mutation since value didn't change
    expect(mutationFn).not.toHaveBeenCalled();
  });
});

describe('RadioField a11y', () => {
  it('has container with group role', () => {
    render(<TestForm label="Priority" />);

    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  it('includes required text for screen readers when required is true', () => {
    render(<TestForm label="Priority" required />);

    expect(screen.getByText('(required)')).toBeInTheDocument();
  });

  it('renders hint text', () => {
    render(<TestForm label="Priority" hintText="Choose the priority level" />);

    expect(screen.getByText('Choose the priority level')).toBeInTheDocument();
  });

  it('clicking on label selects the radio', async () => {
    render(<TestForm label="Priority" defaultValue="low" />);

    // Click on the "High" label text
    await userEvent.click(screen.getByText('High'));

    const radios = screen.getAllByRole('radio');
    expect(radios[2]!).toBeChecked(); // high should be selected
  });
});
