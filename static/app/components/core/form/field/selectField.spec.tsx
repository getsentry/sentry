import {expectTypeOf} from 'expect-type';
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
  describe('types', () => {
    it('should enforce correct types for single select', () => {
      function TypeTestSingleSelect() {
        const form = useScrapsForm({
          ...defaultFormOptions,
          defaultValues: {fruit: ''},
        });

        return (
          <form.AppForm>
            <form.AppField name="fruit">
              {field => (
                <field.Select
                  value={field.state.value}
                  onChange={val => {
                    expectTypeOf(val).toEqualTypeOf<string>();
                    field.handleChange(val);
                  }}
                  options={[
                    {value: 'opt_one', label: 'Option One'},
                    {value: 'opt_two', label: 'Option Two'},
                  ]}
                />
              )}
            </form.AppField>
          </form.AppForm>
        );
      }
      void TypeTestSingleSelect;
    });

    it('should enforce array types for multiple select', () => {
      function TypeTestMultipleSelect() {
        const form = useScrapsForm({
          ...defaultFormOptions,
          defaultValues: {tags: [] as string[]},
        });

        return (
          <form.AppForm>
            <form.AppField name="tags">
              {field => (
                <field.Select
                  multiple
                  value={field.state.value}
                  onChange={val => {
                    expectTypeOf(val).toEqualTypeOf<string[]>();
                    field.handleChange(val);
                  }}
                  options={[
                    {value: 'opt_one', label: 'Option One'},
                    {value: 'opt_two', label: 'Option Two'},
                  ]}
                />
              )}
            </form.AppField>
          </form.AppForm>
        );
      }
      void TypeTestMultipleSelect;
    });

    it('should not allow string value with multiple=true', () => {
      function TypeTestInvalidMultiple() {
        const form = useScrapsForm({
          ...defaultFormOptions,
          defaultValues: {tags: [] as string[]},
        });

        return (
          <form.AppForm>
            <form.AppField name="tags">
              {field => (
                // @ts-expect-error value should be string[] when multiple is true
                <field.Select
                  multiple
                  value="opt_one"
                  onChange={field.handleChange}
                  options={[{value: 'opt_one', label: 'Option One'}]}
                />
              )}
            </form.AppField>
          </form.AppForm>
        );
      }
      void TypeTestInvalidMultiple;
    });

    it('should not allow array value with multiple=false', () => {
      function TypeTestInvalidSingle() {
        const form = useScrapsForm({
          ...defaultFormOptions,
          defaultValues: {fruit: ''},
        });

        return (
          <form.AppForm>
            <form.AppField name="fruit">
              {field => (
                // @ts-expect-error value should be string when multiple is false
                <field.Select
                  value={['opt_one']}
                  onChange={field.handleChange}
                  options={[{value: 'opt_one', label: 'Option One'}]}
                />
              )}
            </form.AppField>
          </form.AppForm>
        );
      }
      void TypeTestInvalidSingle;
    });
  });

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

const MULTI_OPTIONS = [
  {value: 'tag1', label: 'Tag 1'},
  {value: 'tag2', label: 'Tag 2'},
  {value: 'tag3', label: 'Tag 3'},
];

interface MultiTestFormProps {
  label: string;
  defaultValue?: string[];
  disabled?: boolean | string;
}

function MultiTestForm({label, defaultValue = [], disabled}: MultiTestFormProps) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      tags: defaultValue,
    },
  });

  return (
    <form.AppForm>
      <form.AppField name="tags">
        {field => (
          <field.Layout.Row label={label}>
            <field.Select
              multiple
              value={field.state.value}
              onChange={field.handleChange}
              options={MULTI_OPTIONS}
              disabled={disabled}
            />
          </field.Layout.Row>
        )}
      </form.AppField>
    </form.AppForm>
  );
}

describe('SelectField multiple', () => {
  it('renders multi-select with label', () => {
    render(<MultiTestForm label="Tags" />);

    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('displays selected values as chips', () => {
    render(<MultiTestForm label="Tags" defaultValue={['tag1', 'tag2']} />);

    expect(screen.getByText('Tag 1')).toBeInTheDocument();
    expect(screen.getByText('Tag 2')).toBeInTheDocument();
  });

  it('allows selecting multiple options', async () => {
    render(<MultiTestForm label="Tags" />);

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.click(screen.getByRole('menuitemcheckbox', {name: 'Tag 1'}));

    // Menu stays open for multi-select
    await userEvent.click(screen.getByRole('menuitemcheckbox', {name: 'Tag 2'}));

    // Close menu by pressing Escape
    await userEvent.keyboard('{Escape}');

    expect(screen.getByText('Tag 1')).toBeInTheDocument();
    expect(screen.getByText('Tag 2')).toBeInTheDocument();
  });

  it('allows removing selected items', async () => {
    render(<MultiTestForm label="Tags" defaultValue={['tag1', 'tag2']} />);

    // Click the remove button on tag1
    const removeButtons = screen.getAllByLabelText('Remove item');
    await userEvent.click(removeButtons[0]!);

    expect(screen.queryByText('Tag 1')).not.toBeInTheDocument();
    expect(screen.getByText('Tag 2')).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    render(<MultiTestForm label="Tags" disabled />);

    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('shows tooltip with reason when disabled is a string', async () => {
    render(<MultiTestForm label="Tags" disabled="Feature not available" />);

    expect(screen.getByRole('textbox')).toBeDisabled();

    // Hover on the select container to trigger tooltip
    const selectContainer = screen.getByRole('textbox').closest('[class*="container"]');
    await userEvent.hover(selectContainer!);

    await waitFor(() => {
      expect(screen.getByText('Feature not available')).toBeInTheDocument();
    });
  });
});

const multiTestSchema = z.object({
  tags: z.array(z.string()),
});

interface MultiAutoSaveTestFormProps {
  mutationFn: (data: {tags: string[]}) => Promise<{tags: string[]}>;
  initialValue?: string[];
  label?: string;
}

function MultiAutoSaveTestForm({
  mutationFn,
  initialValue = [],
  label = 'Tags',
}: MultiAutoSaveTestFormProps) {
  return (
    <AutoSaveField
      name="tags"
      schema={multiTestSchema}
      initialValue={initialValue}
      mutationOptions={{mutationFn}}
    >
      {field => (
        <field.Layout.Row label={label}>
          <field.Select
            multiple
            value={field.state.value}
            onChange={field.handleChange}
            options={MULTI_OPTIONS}
            clearable
          />
        </field.Layout.Row>
      )}
    </AutoSaveField>
  );
}

describe('SelectField multiple auto-save', () => {
  it('triggers save when clicking X on a tag while menu is closed', async () => {
    const mutationFn = jest.fn((data: {tags: string[]}) => Promise.resolve(data));

    render(
      <MultiAutoSaveTestForm mutationFn={mutationFn} initialValue={['tag1', 'tag2']} />
    );

    // Click the remove button on tag1 (menu is closed)
    const removeButtons = screen.getAllByLabelText('Remove item');
    await userEvent.click(removeButtons[0]!);

    await waitFor(() => {
      expect(mutationFn).toHaveBeenCalledWith({tags: ['tag2']});
    });
  });

  it('triggers save when clicking clear all while menu is closed', async () => {
    const mutationFn = jest.fn((data: {tags: string[]}) => Promise.resolve(data));

    render(
      <MultiAutoSaveTestForm mutationFn={mutationFn} initialValue={['tag1', 'tag2']} />
    );

    // Click clear all button (menu is closed)
    await userEvent.click(screen.getByLabelText('Clear choices'));

    await waitFor(() => {
      expect(mutationFn).toHaveBeenCalledWith({tags: []});
    });
  });

  it('does not trigger save while selecting options with menu open', async () => {
    const mutationFn = jest.fn((data: {tags: string[]}) => Promise.resolve(data));

    render(<MultiAutoSaveTestForm mutationFn={mutationFn} initialValue={[]} />);

    // Open menu and select options
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.click(screen.getByRole('menuitemcheckbox', {name: 'Tag 1'}));

    // Should not have triggered save yet (menu is still open)
    expect(mutationFn).not.toHaveBeenCalled();

    // Select another option
    await userEvent.click(screen.getByRole('menuitemcheckbox', {name: 'Tag 2'}));

    // Still should not have triggered save
    expect(mutationFn).not.toHaveBeenCalled();
  });

  it('triggers save when menu closes after selecting options', async () => {
    const mutationFn = jest.fn((data: {tags: string[]}) => Promise.resolve(data));

    render(<MultiAutoSaveTestForm mutationFn={mutationFn} initialValue={[]} />);

    // Open menu and select options
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.click(screen.getByRole('menuitemcheckbox', {name: 'Tag 1'}));
    await userEvent.click(screen.getByRole('menuitemcheckbox', {name: 'Tag 2'}));

    // Close menu
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(mutationFn).toHaveBeenCalledWith({tags: ['tag1', 'tag2']});
    });
  });

  it('does not trigger multiple saves when removing item while menu is closed', async () => {
    const mutationFn = jest.fn((data: {tags: string[]}) => Promise.resolve(data));

    render(
      <MultiAutoSaveTestForm
        mutationFn={mutationFn}
        initialValue={['tag1', 'tag2', 'tag3']}
      />
    );

    // Remove first item
    const removeButtons = screen.getAllByLabelText('Remove item');
    await userEvent.click(removeButtons[0]!);

    await waitFor(() => {
      expect(mutationFn).toHaveBeenCalledTimes(1);
    });

    expect(mutationFn).toHaveBeenCalledWith({tags: ['tag2', 'tag3']});
  });

  it('shows spinner when auto-save is pending for multi-select', async () => {
    const mutationFn = jest.fn(() => new Promise<{tags: string[]}>(() => {}));

    render(
      <MultiAutoSaveTestForm mutationFn={mutationFn} initialValue={['tag1', 'tag2']} />
    );

    // Remove an item to trigger save
    const removeButtons = screen.getAllByLabelText('Remove item');
    await userEvent.click(removeButtons[0]!);

    expect(await screen.findByRole('status', {name: 'Saving tags'})).toBeInTheDocument();
  });

  it('disables multi-select while auto-save is pending', async () => {
    const mutationFn = jest.fn(() => new Promise<{tags: string[]}>(() => {}));

    render(
      <MultiAutoSaveTestForm mutationFn={mutationFn} initialValue={['tag1', 'tag2']} />
    );

    // Remove an item to trigger save
    const removeButtons = screen.getAllByLabelText('Remove item');
    await userEvent.click(removeButtons[0]!);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDisabled();
    });
  });
});
