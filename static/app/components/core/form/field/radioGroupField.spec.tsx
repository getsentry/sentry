import {expectTypeOf} from 'expect-type';
import {z} from 'zod';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AutoSaveForm, defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

const testSchema = z.object({
  priority: z.enum(['low', 'medium', 'high']),
});

type Priority = z.infer<typeof testSchema>['priority'];

interface TestFormProps {
  label: string;
  defaultValue?: Priority;
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
          <field.RadioGroup
            value={field.state.value}
            onChange={field.handleChange}
            disabled={disabled}
          >
            {({Item}) => (
              <field.Layout.Row label={label} hintText={hintText} required={required}>
                <Item value="low">Low</Item>
                <Item value="medium">Medium</Item>
                <Item value="high" description="Urgent issues">
                  High
                </Item>
              </field.Layout.Row>
            )}
          </field.RadioGroup>
        )}
      </form.AppField>
    </form.AppForm>
  );
}

interface AutoSaveTestFormProps {
  mutationFn: (data: {priority: string}) => Promise<{priority: string}>;
  initialValue?: Priority;
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
    <AutoSaveForm
      name="priority"
      schema={testSchema}
      initialValue={initialValue}
      mutationOptions={{mutationFn, onError}}
    >
      {field => (
        <field.RadioGroup value={field.state.value} onChange={field.handleChange}>
          {({Item}) => (
            <field.Layout.Row label={label}>
              <Item value="low">Low</Item>
              <Item value="medium">Medium</Item>
              <Item value="high">High</Item>
            </field.Layout.Row>
          )}
        </field.RadioGroup>
      )}
    </AutoSaveForm>
  );
}

describe('RadioGroupField types', () => {
  it('infers the field union for onChange and Item without an explicit type argument', () => {
    function TypeTest({value}: {value: Priority}) {
      const form = useScrapsForm({defaultValues: {priority: value}});

      return (
        <form.AppField name="priority">
          {field => (
            <field.RadioGroup
              value={field.state.value}
              onChange={next => {
                expectTypeOf(next).toEqualTypeOf<Priority>();
                field.handleChange(next);
              }}
            >
              {({Item}) => {
                expectTypeOf<
                  React.ComponentProps<typeof Item>['value']
                >().toEqualTypeOf<Priority>();
                return <Item value="high">High</Item>;
              }}
            </field.RadioGroup>
          )}
        </form.AppField>
      );
    }
    void TypeTest;
  });

  it('infers the schema union for auto-save fields', () => {
    function TypeTest() {
      return (
        <AutoSaveForm
          name="priority"
          schema={testSchema}
          initialValue="low"
          mutationOptions={{
            mutationFn: (data: z.infer<typeof testSchema>) => Promise.resolve(data),
          }}
        >
          {field => (
            <field.RadioGroup
              value={field.state.value}
              onChange={next => {
                expectTypeOf(next).toEqualTypeOf<Priority>();
                field.handleChange(next);
              }}
            >
              {({Item}) => {
                expectTypeOf<
                  React.ComponentProps<typeof Item>['value']
                >().toEqualTypeOf<Priority>();
                return (
                  // @ts-expect-error Item values must belong to the schema's union.
                  <Item value="urgent">Urgent</Item>
                );
              }}
            </field.RadioGroup>
          )}
        </AutoSaveForm>
      );
    }
    void TypeTest;
  });

  it('rejects item values outside the field union even with a wider onChange', () => {
    function TypeTest({value}: {value: Priority}) {
      const form = useScrapsForm({defaultValues: {priority: value}});

      return (
        <form.AppField name="priority">
          {field => (
            <field.RadioGroup value={field.state.value} onChange={(_value: string) => {}}>
              {({Item}) => {
                expectTypeOf<
                  React.ComponentProps<typeof Item>['value']
                >().toEqualTypeOf<Priority>();
                return (
                  // @ts-expect-error Item values must belong to the field's union.
                  <Item value="urgent">Urgent</Item>
                );
              }}
            </field.RadioGroup>
          )}
        </form.AppField>
      );
    }
    void TypeTest;
  });

  it('rejects an onChange callback that only accepts part of the field union', () => {
    function TypeTest({value}: {value: Priority}) {
      const form = useScrapsForm({defaultValues: {priority: value}});

      return (
        <form.AppField name="priority">
          {field => (
            <field.RadioGroup
              value={field.state.value}
              // @ts-expect-error The callback must accept every value in the field's union.
              onChange={(_value: 'low') => {}}
            >
              {({Item}) => <Item value="high">High</Item>}
            </field.RadioGroup>
          )}
        </form.AppField>
      );
    }
    void TypeTest;
  });

  it('supports fields with unrestricted string values', () => {
    function TypeTest() {
      const form = useScrapsForm({defaultValues: {priority: ''}});

      return (
        <form.AppField name="priority">
          {field => (
            <field.RadioGroup
              value={field.state.value}
              onChange={next => {
                expectTypeOf(next).toEqualTypeOf<string>();
                field.handleChange(next);
              }}
            >
              {({Item}) => {
                expectTypeOf<
                  React.ComponentProps<typeof Item>['value']
                >().toEqualTypeOf<string>();
                return <Item value="custom">Custom</Item>;
              }}
            </field.RadioGroup>
          )}
        </form.AppField>
      );
    }
    void TypeTest;
  });
});

describe('RadioGroupField', () => {
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
    render(<TestForm label="Priority" />);

    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toBeChecked(); // low initially

    await userEvent.click(radios[2]!); // click high

    expect(radios[0]).not.toBeChecked();
    expect(radios[2]!).toBeChecked();
    expect(radios[2]!).toHaveFocus();
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

describe('RadioGroupField disabled', () => {
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

    const lockIcon = screen.getByRole('img', {name: 'Disabled'});
    expect(lockIcon).toBeInTheDocument();

    // Hover on the lock icon to trigger tooltip
    await userEvent.hover(lockIcon);

    await waitFor(() => {
      expect(screen.getByText('Feature not available')).toBeInTheDocument();
    });
  });
});

describe('RadioGroupField auto-save', () => {
  it('shows spinner when auto-save is pending', async () => {
    const mutationFn = jest.fn(() => new Promise<{priority: string}>(() => {}));

    render(<AutoSaveTestForm mutationFn={mutationFn} />);

    const radios = screen.getAllByRole('radio');
    await userEvent.click(radios[2]!); // click high

    expect(
      await screen.findByRole('status', {name: 'Saving priority'})
    ).toBeInTheDocument();
    expect(mutationFn).toHaveBeenCalledWith({priority: 'high'}, expect.anything());
  });

  it('shows checkmark when auto-save succeeds', async () => {
    const mutationFn = jest.fn((data: {priority: string}) => Promise.resolve(data));

    render(<AutoSaveTestForm mutationFn={mutationFn} />);

    const radios = screen.getAllByRole('radio');
    await userEvent.click(radios[2]!); // click high

    expect(await screen.findByTestId('icon-check-mark')).toBeInTheDocument();
    expect(mutationFn).toHaveBeenCalledWith({priority: 'high'}, expect.anything());
  });

  it('disables radios while auto-save is pending', async () => {
    const mutationFn = jest.fn(() => new Promise<{priority: string}>(() => {}));

    render(<AutoSaveTestForm mutationFn={mutationFn} />);

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

    render(<AutoSaveTestForm mutationFn={mutationFn} />);

    const radios = screen.getAllByRole('radio');
    // Click the already selected option
    await userEvent.click(radios[0]!); // low is already selected

    // Should not trigger mutation since value didn't change
    expect(mutationFn).not.toHaveBeenCalled();
  });
});

describe('RadioGroupField a11y', () => {
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
    render(<TestForm label="Priority" />);

    // Click on the "High" label text
    await userEvent.click(screen.getByText('High'));

    const radios = screen.getAllByRole('radio');
    expect(radios[2]!).toBeChecked(); // high should be selected
  });
});
