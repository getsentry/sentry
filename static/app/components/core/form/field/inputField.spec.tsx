import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

function TestForm() {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {amount: ''},
  });

  return (
    <form.AppForm form={form}>
      <form.AppField name="amount">
        {field => (
          <field.Layout.Row label="Amount">
            <field.Input
              leadingItems="$"
              value={field.state.value}
              onChange={field.handleChange}
            />
          </field.Layout.Row>
        )}
      </form.AppField>
    </form.AppForm>
  );
}

describe('InputField', () => {
  it('renders leading items and updates its value', async () => {
    render(<TestForm />);

    expect(screen.getByText('$')).toBeInTheDocument();

    const input = screen.getByRole('textbox', {name: 'Amount'});
    await userEvent.type(input, '100');

    expect(input).toHaveValue('100');
  });
});
