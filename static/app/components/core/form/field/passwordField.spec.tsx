import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

interface TestFormProps {
  defaultValue?: string;
  disabled?: boolean | string;
  label?: string;
}

function TestForm({defaultValue = '', disabled, label = 'Password'}: TestFormProps) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {password: defaultValue},
  });

  return (
    <form.AppForm>
      <form.AppField name="password">
        {field => (
          <field.Layout.Row label={label}>
            <field.Password
              value={field.state.value}
              onChange={field.handleChange}
              disabled={disabled}
            />
          </field.Layout.Row>
        )}
      </form.AppField>
    </form.AppForm>
  );
}

describe('PasswordField', () => {
  it('renders as a password input by default', () => {
    render(<TestForm />);

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('shows password when toggle is clicked', async () => {
    render(<TestForm />);

    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', {name: 'Show password'}));

    expect(input).toHaveAttribute('type', 'text');
  });

  it('hides password when toggle is clicked again', async () => {
    render(<TestForm />);

    const input = screen.getByLabelText('Password');

    await userEvent.click(screen.getByRole('button', {name: 'Show password'}));
    expect(input).toHaveAttribute('type', 'text');

    await userEvent.click(screen.getByRole('button', {name: 'Hide password'}));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('updates aria-label on toggle button when visibility changes', async () => {
    render(<TestForm />);

    expect(screen.getByRole('button', {name: 'Show password'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Show password'}));

    expect(screen.getByRole('button', {name: 'Hide password'})).toBeInTheDocument();
  });

  it('accepts typed input', async () => {
    render(<TestForm />);

    await userEvent.type(screen.getByLabelText('Password'), 'secret123');

    expect(screen.getByLabelText('Password')).toHaveValue('secret123');
  });
});

describe('PasswordField disabled', () => {
  it('is read-only when disabled prop is true', () => {
    render(<TestForm disabled />);

    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByLabelText('Password')).toHaveAttribute('readonly');
  });

  it('shows tooltip with reason when disabled is a string', async () => {
    render(<TestForm disabled="Password changes are not allowed" />);

    await userEvent.hover(screen.getByLabelText('Password'));

    expect(
      await screen.findByText('Password changes are not allowed')
    ).toBeInTheDocument();
  });
});
