import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

import {SuperuserAccessCategory} from 'getsentry/overrides/superuserAccessCategory';

function TestForm() {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {superuserAccessCategory: 'development'},
  });

  return (
    <form.AppForm form={form}>
      <form.AppField name="superuserAccessCategory">
        {field => (
          <field.Radio.Group value={field.state.value} onChange={field.handleChange}>
            <field.Layout.Stack label="Categories of Superuser Access" required>
              <SuperuserAccessCategory RadioItem={field.Radio.Item} />
            </field.Layout.Stack>
          </field.Radio.Group>
        )}
      </form.AppField>
    </form.AppForm>
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
