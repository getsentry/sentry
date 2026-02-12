import {render, screen} from 'sentry-test/reactTestingLibrary';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

function TestForm({
  label,
  hintText,
  required,
}: {
  label: string;
  hintText?: string;
  required?: boolean;
}) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      testField: '',
    },
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

  it('renders the required indicator when required is true', () => {
    render(<TestForm label="Required Field" required />);

    expect(screen.getByText('*')).toBeInTheDocument();
  });
});
