import {z} from 'zod';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

function TestForm() {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {subscribe: false},
    validators: {onDynamic: z.object({subscribe: z.boolean()})},
  });

  return (
    <form.AppForm form={form}>
      <form.AppField name="subscribe">
        {field => (
          <field.Checkbox
            checked={field.state.value}
            onChange={field.handleChange}
            label="Subscribe to updates"
            hintText="Monthly product news"
          />
        )}
      </form.AppField>
    </form.AppForm>
  );
}

describe('CheckboxField', () => {
  it('links the label and hint to the checkbox', async () => {
    render(<TestForm />);

    const checkbox = screen.getByRole('checkbox', {name: 'Subscribe to updates'});
    const hint = screen.getByText('Monthly product news');

    expect(checkbox).toHaveAttribute('aria-describedby', hint.id);

    await userEvent.click(screen.getByText('Subscribe to updates'));
    expect(checkbox).toBeChecked();
  });
});
