import {z} from 'zod';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AutoSaveField, defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

interface TestFormProps {
  label: string;
  defaultValue?: string;
  hintText?: string;
  required?: boolean;
  validator?: z.ZodObject<{testField: z.ZodString}>;
}

function TestForm({label, hintText, required, defaultValue, validator}: TestFormProps) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      testField: defaultValue ?? '',
    },
    validators: validator ? {onBlur: validator} : undefined,
  });

  return (
    <form.AppForm>
      <form.AppField name="testField">
        {field => (
          <field.Layout.Row label={label} hintText={hintText} required={required}>
            <field.Input value={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </form.AppField>
    </form.AppForm>
  );
}

const testSchema = z.object({
  testField: z.string(),
});

interface AutoSaveTestFormProps {
  mutationFn: (data: {testField: string}) => Promise<{testField: string}>;
  initialValue?: string;
  label?: string;
}

function AutoSaveTestForm({
  mutationFn,
  initialValue = '',
  label = 'Username',
}: AutoSaveTestFormProps) {
  return (
    <AutoSaveField
      name="testField"
      schema={testSchema}
      initialValue={initialValue}
      mutationOptions={{mutationFn}}
    >
      {field => (
        <field.Layout.Row label={label}>
          <field.Input value={field.state.value} onChange={field.handleChange} />
        </field.Layout.Row>
      )}
    </AutoSaveField>
  );
}

describe('BaseField a11y', () => {
  it('associates the input with its label via htmlFor/id', () => {
    render(<TestForm label="Username" />);

    const input = screen.getByRole('textbox');
    const label = screen.getByText('Username');

    expect(input).toHaveAttribute('id');
    expect(label).toHaveAttribute('for', input.getAttribute('id'));
  });

  it('associates the input with hint text via aria-describedby', () => {
    render(<TestForm label="Username" hintText="Enter your username" />);

    const input = screen.getByRole('textbox');
    const hintText = screen.getByText('Enter your username');

    expect(input).toHaveAttribute('aria-describedby');
    expect(hintText).toHaveAttribute('id', input.getAttribute('aria-describedby'));
  });

  it('can find input by accessible name from label', () => {
    render(<TestForm label="Email Address" />);

    expect(screen.getByRole('textbox', {name: 'Email Address'})).toBeInTheDocument();
  });

  it('includes required in accessible name when required is true', () => {
    render(<TestForm label="Required Field" required />);

    expect(screen.getByText('(required)')).toBeInTheDocument();
  });
});

describe('BaseField aria-invalid', () => {
  const validationSchema = z.object({
    testField: z.string().min(3, 'Must be at least 3 characters'),
  });

  it('is not invalid when field is untouched', () => {
    render(<TestForm label="Username" defaultValue="" validator={validationSchema} />);

    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'false');
  });

  it('is invalid when field is touched and has validation errors', async () => {
    render(<TestForm label="Username" defaultValue="ab" validator={validationSchema} />);

    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.tab(); // blur

    await waitFor(() => {
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('is not invalid when field is touched and valid', async () => {
    render(<TestForm label="Username" defaultValue="abc" validator={validationSchema} />);

    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.tab(); // blur

    await waitFor(() => {
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });
  });
});

describe('BaseField indicator', () => {
  it('shows no indicator initially', () => {
    render(<TestForm label="Username" />);

    expect(screen.queryByTestId('icon-check-mark')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows spinner when auto-save is pending', async () => {
    // Mutation that never resolves to keep the spinner visible
    const mutationFn = jest.fn(() => new Promise<{testField: string}>(() => {}));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue="initial" />);

    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'changed');
    await userEvent.tab(); // blur triggers auto-save

    expect(
      await screen.findByRole('status', {name: 'Saving testField'})
    ).toBeInTheDocument();
    expect(mutationFn).toHaveBeenCalledWith({testField: 'changed'});
  });

  it('shows checkmark when auto-save succeeds', async () => {
    const mutationFn = jest.fn((data: {testField: string}) => Promise.resolve(data));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue="initial" />);

    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'changed');
    await userEvent.tab(); // blur triggers auto-save

    expect(await screen.findByTestId('icon-check-mark')).toBeInTheDocument();
    expect(mutationFn).toHaveBeenCalledWith({testField: 'changed'});
  });

  it('shows warning icon when field has validation errors', async () => {
    const validationSchema = z.object({
      testField: z.string().min(3, 'Must be at least 3 characters'),
    });

    render(<TestForm label="Username" defaultValue="ab" validator={validationSchema} />);

    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.tab(); // blur to trigger validation

    await waitFor(() => {
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
  });

  it('shows error message in tooltip when field has validation errors', async () => {
    const validationSchema = z.object({
      testField: z.string().min(3, 'Must be at least 3 characters'),
    });

    render(<TestForm label="Username" defaultValue="ab" validator={validationSchema} />);

    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.tab(); // blur to trigger validation

    await waitFor(() => {
      expect(screen.getByText('Must be at least 3 characters')).toBeInTheDocument();
    });
  });
});

describe('BaseField onBlur', () => {
  it('triggers validation on blur', async () => {
    const validationSchema = z.object({
      testField: z.string().min(3, 'Too short'),
    });

    render(<TestForm label="Username" defaultValue="ab" validator={validationSchema} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'false');

    await userEvent.click(input);
    await userEvent.tab(); // blur

    await waitFor(() => {
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });
  });
});
