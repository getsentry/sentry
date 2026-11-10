import {z} from 'zod';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useScrapsForm, ScrapsForm, defaultFormValidators} from '@sentry/scraps/form';

function TestForm() {
  const form = useScrapsForm({
    defaultValues: {subscribe: false},
    validators: defaultFormValidators(z.object({subscribe: z.boolean()})),
  });

  return (
    <ScrapsForm form={form}>
      <form.Field name="subscribe">
        {field => (
          <field.Checkbox
            checked={field.value}
            onChange={field.handleChange}
            label="Subscribe to updates"
            hintText="Monthly product news"
          />
        )}
      </form.Field>
    </ScrapsForm>
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
