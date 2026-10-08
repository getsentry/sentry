import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useScrapsForm, ScrapsForm} from '@sentry/scraps/form';

function TestForm() {
  const form = useScrapsForm({
    defaultValues: {amount: ''},
  });

  return (
    <ScrapsForm form={form}>
      <form.Field name="amount">
        {field => (
          <field.Layout.Row label="Amount">
            <field.Input
              leadingItems="$"
              value={field.value}
              onChange={field.handleChange}
            />
          </field.Layout.Row>
        )}
      </form.Field>
    </ScrapsForm>
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
