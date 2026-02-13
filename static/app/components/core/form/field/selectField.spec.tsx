import {z} from 'zod';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AutoSaveField, defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

const OPTIONS = [
  {value: 'apple', label: 'Apple'},
  {value: 'banana', label: 'Banana'},
  {value: 'cherry', label: 'Cherry'},
];

interface TestFormProps {
  label: string;
  defaultValue?: string;
  disabled?: boolean | string;
  hintText?: string;
  placeholder?: string;
  required?: boolean;
  validator?: z.ZodObject<{fruit: z.ZodString}>;
}

function TestForm({
  label,
  hintText,
  required,
  defaultValue = '',
  disabled,
  placeholder,
  validator,
}: TestFormProps) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      fruit: defaultValue,
    },
    validators: validator ? {onBlur: validator} : undefined,
  });

  return (
    <form.AppForm>
      <form.AppField name="fruit">
        {field => (
          <field.Layout.Row label={label} hintText={hintText} required={required}>
            <field.Select
              value={field.state.value}
              onChange={field.handleChange}
              options={OPTIONS}
              disabled={disabled}
              placeholder={placeholder}
            />
          </field.Layout.Row>
        )}
      </form.AppField>
    </form.AppForm>
  );
}

const testSchema = z.object({
  fruit: z.string(),
});

interface AutoSaveTestFormProps {
  mutationFn: (data: {fruit: string}) => Promise<{fruit: string}>;
  initialValue?: string;
  label?: string;
}

function AutoSaveTestForm({
  mutationFn,
  initialValue = '',
  label = 'Favorite Fruit',
}: AutoSaveTestFormProps) {
  return (
    <AutoSaveField
      name="fruit"
      schema={testSchema}
      initialValue={initialValue}
      mutationOptions={{mutationFn}}
    >
      {field => (
        <field.Layout.Row label={label}>
          <field.Select
            value={field.state.value}
            onChange={field.handleChange}
            options={OPTIONS}
          />
        </field.Layout.Row>
      )}
    </AutoSaveField>
  );
}

describe('SelectField', () => {
  it('renders with a label', () => {
    render(<TestForm label="Favorite Fruit" />);

    expect(screen.getByText('Favorite Fruit')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('displays the selected value', () => {
    render(<TestForm label="Favorite Fruit" defaultValue="banana" />);

    expect(screen.getByText('Banana')).toBeInTheDocument();
  });

  it('shows options when clicked', async () => {
    render(<TestForm label="Favorite Fruit" />);

    await userEvent.click(screen.getByRole('textbox'));

    expect(screen.getByRole('menuitemradio', {name: 'Apple'})).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Banana'})).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Cherry'})).toBeInTheDocument();
  });

  it('allows selecting an option', async () => {
    render(<TestForm label="Favorite Fruit" />);

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Cherry'}));

    expect(screen.getByText('Cherry')).toBeInTheDocument();
  });
});

describe('SelectField disabled', () => {
  it('is disabled when disabled prop is true', () => {
    render(<TestForm label="Favorite Fruit" disabled />);

    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('shows tooltip with reason when disabled is a string', async () => {
    render(<TestForm label="Favorite Fruit" disabled="Feature not available" />);

    expect(screen.getByRole('textbox')).toBeDisabled();

    // Hover on the select container to trigger tooltip
    const selectContainer = screen.getByRole('textbox').closest('[class*="container"]');
    await userEvent.hover(selectContainer!);

    await waitFor(() => {
      expect(screen.getByText('Feature not available')).toBeInTheDocument();
    });
  });
});

describe('SelectField auto-save', () => {
  it('shows spinner when auto-save is pending', async () => {
    const mutationFn = jest.fn(() => new Promise<{fruit: string}>(() => {}));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue="apple" />);

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Banana'}));

    expect(await screen.findByRole('status', {name: 'Saving fruit'})).toBeInTheDocument();
    expect(mutationFn).toHaveBeenCalledWith({fruit: 'banana'});
  });

  it('shows checkmark when auto-save succeeds', async () => {
    const mutationFn = jest.fn((data: {fruit: string}) => Promise.resolve(data));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue="apple" />);

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Banana'}));

    expect(await screen.findByTestId('icon-check-mark')).toBeInTheDocument();
    expect(mutationFn).toHaveBeenCalledWith({fruit: 'banana'});
  });

  it('disables select while auto-save is pending', async () => {
    const mutationFn = jest.fn(() => new Promise<{fruit: string}>(() => {}));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue="apple" />);

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Banana'}));

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDisabled();
    });
  });

  it('does not trigger mutation when selecting the same value', async () => {
    const mutationFn = jest.fn((data: {fruit: string}) => Promise.resolve(data));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue="apple" />);

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Apple'}));

    // Wait a bit to ensure no mutation is triggered
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(mutationFn).not.toHaveBeenCalled();
  });
});

describe('SelectField keyboard navigation', () => {
  it('opens menu with arrow down key', async () => {
    render(<TestForm label="Favorite Fruit" />);

    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.keyboard('{Escape}'); // Close menu first

    expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();

    await userEvent.keyboard('{ArrowDown}');

    expect(screen.getByRole('menuitemradio', {name: 'Apple'})).toBeInTheDocument();
  });

  it('navigates options with arrow keys', async () => {
    render(<TestForm label="Favorite Fruit" />);

    await userEvent.click(screen.getByRole('textbox'));

    // First option is focused by default
    expect(screen.getByRole('menuitemradio', {name: 'Apple'})).toHaveClass(
      'option--is-focused'
    );

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', {name: 'Banana'})).toHaveClass(
      'option--is-focused'
    );

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', {name: 'Cherry'})).toHaveClass(
      'option--is-focused'
    );
  });

  it('selects option with Enter key', async () => {
    render(<TestForm label="Favorite Fruit" />);

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.keyboard('{ArrowDown}'); // Move to Banana
    await userEvent.keyboard('{Enter}');

    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
  });

  it('closes menu with Escape key', async () => {
    render(<TestForm label="Favorite Fruit" />);

    await userEvent.click(screen.getByRole('textbox'));
    expect(screen.getByRole('menuitemradio', {name: 'Apple'})).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
  });
});

describe('SelectField filtering', () => {
  it('filters options when typing', async () => {
    render(<TestForm label="Favorite Fruit" />);

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.keyboard('ban');

    expect(screen.getByRole('menuitemradio', {name: 'Banana'})).toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', {name: 'Apple'})).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', {name: 'Cherry'})).not.toBeInTheDocument();
  });

  it('shows no options message when filter matches nothing', async () => {
    render(<TestForm label="Favorite Fruit" />);

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.keyboard('xyz');

    expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
    expect(screen.getByText('No options')).toBeInTheDocument();
  });
});

describe('SelectField placeholder', () => {
  it('shows default placeholder when no value is selected', () => {
    render(<TestForm label="Favorite Fruit" />);

    expect(screen.getByText('Select...')).toBeInTheDocument();
  });

  it('shows custom placeholder when provided', () => {
    render(<TestForm label="Favorite Fruit" placeholder="Choose a fruit" />);

    expect(screen.getByText('Choose a fruit')).toBeInTheDocument();
  });

  it('hides placeholder when value is selected', () => {
    render(
      <TestForm
        label="Favorite Fruit"
        defaultValue="apple"
        placeholder="Choose a fruit"
      />
    );

    expect(screen.queryByText('Choose a fruit')).not.toBeInTheDocument();
    expect(screen.getByText('Apple')).toBeInTheDocument();
  });
});

describe('SelectField a11y', () => {
  it('focuses the select input when clicking on the label', async () => {
    render(<TestForm label="Favorite Fruit" />);

    await userEvent.click(screen.getByText('Favorite Fruit'));

    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('includes required text for screen readers when required is true', () => {
    render(<TestForm label="Favorite Fruit" required />);

    // The label should include visually-hidden "(required)" text for screen readers
    expect(screen.getByText('(required)')).toBeInTheDocument();
  });

  it('renders hint text', () => {
    render(<TestForm label="Favorite Fruit" hintText="Select your favorite fruit" />);

    expect(screen.getByText('Select your favorite fruit')).toBeInTheDocument();
  });

  it('has aria-invalid false by default', () => {
    render(<TestForm label="Favorite Fruit" />);

    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'false');
  });

  it('has aria-invalid true when validation fails', async () => {
    const validationSchema = z.object({
      fruit: z.string().min(1, 'Selection required'),
    });

    render(<TestForm label="Favorite Fruit" validator={validationSchema} />);

    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.tab(); // blur to trigger validation

    await waitFor(() => {
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });
  });
});
