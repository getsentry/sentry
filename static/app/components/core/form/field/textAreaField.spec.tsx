import {z} from 'zod';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AutoSaveField, defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

interface TestFormProps {
  label: string;
  autosize?: boolean;
  defaultValue?: string;
  disabled?: boolean | string;
  hintText?: string;
  required?: boolean;
  rows?: number;
}

function TestForm({
  label,
  hintText,
  required,
  defaultValue = '',
  disabled,
  rows,
  autosize,
}: TestFormProps) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      bio: defaultValue,
    },
  });

  return (
    <form.AppForm>
      <form.AppField name="bio">
        {field => (
          <field.Layout.Row label={label} hintText={hintText} required={required}>
            <field.TextArea
              value={field.state.value}
              onChange={field.handleChange}
              disabled={disabled}
              rows={rows}
              autosize={autosize}
            />
          </field.Layout.Row>
        )}
      </form.AppField>
    </form.AppForm>
  );
}

const testSchema = z.object({
  bio: z.string(),
});

interface AutoSaveTestFormProps {
  mutationFn: (data: {bio: string}) => Promise<{bio: string}>;
  initialValue?: string;
  label?: string;
}

function AutoSaveTestForm({
  mutationFn,
  initialValue = '',
  label = 'Bio',
}: AutoSaveTestFormProps) {
  return (
    <AutoSaveField
      name="bio"
      schema={testSchema}
      initialValue={initialValue}
      mutationOptions={{mutationFn}}
    >
      {field => (
        <field.Layout.Row label={label}>
          <field.TextArea value={field.state.value} onChange={field.handleChange} />
        </field.Layout.Row>
      )}
    </AutoSaveField>
  );
}

describe('TextAreaField', () => {
  it('renders with a label', () => {
    render(<TestForm label="Bio" />);

    expect(screen.getByText('Bio')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('displays value correctly', () => {
    render(<TestForm label="Bio" defaultValue="Hello world" />);

    expect(screen.getByRole('textbox')).toHaveValue('Hello world');
  });

  it('updates value on change', async () => {
    render(<TestForm label="Bio" />);

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'New bio text');

    expect(textarea).toHaveValue('New bio text');
  });
});

describe('TextAreaField disabled', () => {
  it('is disabled when disabled prop is true', () => {
    render(<TestForm label="Bio" disabled />);

    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
  });

  it('shows tooltip with reason when disabled is a string', async () => {
    render(<TestForm label="Bio" disabled="Feature not available" />);

    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');

    // Hover on the textarea to trigger tooltip
    await userEvent.hover(screen.getByRole('textbox'));

    await waitFor(() => {
      expect(screen.getByText('Feature not available')).toBeInTheDocument();
    });
  });
});

describe('TextAreaField auto-save', () => {
  it('shows spinner when auto-save is pending', async () => {
    const mutationFn = jest.fn(() => new Promise<{bio: string}>(() => {}));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue="" />);

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'test');
    // AutoSaveField triggers mutation on blur for string fields
    await userEvent.tab();

    expect(await screen.findByRole('status', {name: 'Saving bio'})).toBeInTheDocument();
    expect(mutationFn).toHaveBeenCalledWith({bio: 'test'});
  });

  it('shows checkmark when auto-save succeeds', async () => {
    const mutationFn = jest.fn((data: {bio: string}) => Promise.resolve(data));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue="" />);

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'test');
    // AutoSaveField triggers mutation on blur for string fields
    await userEvent.tab();

    await waitFor(() => {
      expect(screen.getByTestId('icon-check-mark')).toBeInTheDocument();
    });
    expect(mutationFn).toHaveBeenCalledWith({bio: 'test'});
  });

  it('disables textarea while auto-save is pending', async () => {
    const mutationFn = jest.fn(() => new Promise<{bio: string}>(() => {}));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue="" />);

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'test');
    // AutoSaveField triggers mutation on blur for string fields
    await userEvent.tab();

    await waitFor(() => {
      expect(textarea).toHaveAttribute('readonly');
    });
  });

  it('does not trigger mutation when value unchanged', async () => {
    const mutationFn = jest.fn((data: {bio: string}) => Promise.resolve(data));

    render(<AutoSaveTestForm mutationFn={mutationFn} initialValue="initial" />);

    const textarea = screen.getByRole('textbox');
    // Just focus and blur without changing the value
    textarea.focus();
    await userEvent.tab();

    // Wait a bit to ensure no mutation is triggered
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(mutationFn).not.toHaveBeenCalled();
  });
});

describe('TextAreaField props', () => {
  it('supports rows prop', () => {
    render(<TestForm label="Bio" rows={5} />);

    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '5');
  });

  it('supports autosize prop', () => {
    render(<TestForm label="Bio" autosize />);

    // autosize uses react-textarea-autosize which adds specific styles
    // Just verify the textarea renders correctly
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});

describe('TextAreaField a11y', () => {
  it('focuses the textarea when clicking on the label', async () => {
    render(<TestForm label="Bio" />);

    await userEvent.click(screen.getByText('Bio'));

    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('includes required text for screen readers when required is true', () => {
    render(<TestForm label="Bio" required />);

    expect(screen.getByText('(required)')).toBeInTheDocument();
  });

  it('renders hint text', () => {
    render(<TestForm label="Bio" hintText="Tell us about yourself" />);

    expect(screen.getByText('Tell us about yourself')).toBeInTheDocument();
  });

  it('has aria-invalid false by default', () => {
    render(<TestForm label="Bio" />);

    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'false');
  });
});
