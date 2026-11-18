import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ScrapsForm, useScrapsForm} from '@sentry/scraps/form';

import {SuperuserAccessCategory} from 'getsentry/overrides/superuserAccessCategory';

function TestForm() {
  const form = useScrapsForm({
    defaultValues: {superuserAccessCategory: 'development'},
  });

  return (
    <ScrapsForm form={form}>
      <form.Field name="superuserAccessCategory">
        {field => (
          <field.RadioGroup value={field.value} onChange={field.handleChange}>
            {({Item}) => (
              <field.Layout.Stack label="Categories of Superuser Access" required>
                <SuperuserAccessCategory RadioItem={Item} />
              </field.Layout.Stack>
            )}
          </field.RadioGroup>
        )}
      </form.Field>
    </ScrapsForm>
  );
}

describe('SuperuserAccessCategory', () => {
  it('renders category options inside a bound Scraps field', async () => {
    render(<TestForm />);

    expect(
      screen.getByRole('radiogroup', {name: 'Categories of Superuser Access'})
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Development'})).toBeChecked();
    expect(screen.getByText('(required)')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', {name: 'Debugging'}));
    expect(screen.getByRole('radio', {name: 'Debugging'})).toBeChecked();
  });
});
