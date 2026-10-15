import {createRef} from 'react';
import {z} from 'zod';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';
import {AutoSaveForm, defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

const OPTIONS = [
  {value: 'apple', label: 'Apple'},
  {value: 'banana', label: 'Banana'},
];

function TestForm({
  customTrigger = false,
  buttonRef,
  disabled,
  options = OPTIONS,
  menuFooter,
}: {
  buttonRef?: React.Ref<HTMLButtonElement>;
  customTrigger?: boolean;
  disabled?: boolean;
  menuFooter?: React.ReactNode;
  options?: typeof OPTIONS;
}) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {fruit: null as string | null},
    validators: {onDynamic: z.object({fruit: z.string('Select a fruit')})},
  });

  return (
    <form.AppForm form={form}>
      <form.AppField name="fruit">
        {field => (
          <field.Layout.Stack label="Fruit" hintText="Choose your favorite fruit">
            <field.CompactSelect
              ref={buttonRef}
              value={field.state.value}
              onChange={field.handleChange}
              options={options}
              disabled={disabled}
              menuFooter={menuFooter}
              trigger={
                customTrigger
                  ? props => (
                      <OverlayTrigger.Button {...props}>Pick fruit</OverlayTrigger.Button>
                    )
                  : undefined
              }
            />
          </field.Layout.Stack>
        )}
      </form.AppField>
      <form.SubmitButton>Submit</form.SubmitButton>
    </form.AppForm>
  );
}

it.each([false, true])(
  'connects the trigger to the field (custom trigger: %s)',
  async customTrigger => {
    const ref = createRef<HTMLButtonElement>();
    render(<TestForm customTrigger={customTrigger} buttonRef={ref} />);

    const button = screen.getByRole('button', {name: 'Fruit'});
    expect(ref.current).toBe(button);
    expect(button).toHaveAccessibleDescription('Choose your favorite fruit');

    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));
    expect(button).toHaveAttribute('aria-invalid', 'true');
    expect(button).toHaveFocus();

    await userEvent.click(button);
    expect(await screen.findByRole('listbox')).toHaveAccessibleName('Fruit');
    await userEvent.click(screen.getByRole('option', {name: 'Banana'}));
    expect(button).toHaveAttribute('aria-invalid', 'false');
    if (!customTrigger) {
      expect(button).toHaveTextContent('Banana');
    }
  }
);

it('keeps an empty menu openable when disabled is explicitly false', async () => {
  const onCreate = jest.fn();
  const {rerender} = render(<TestForm options={[]} />);
  const button = screen.getByRole('button', {name: 'Fruit'});
  expect(button).toBeDisabled();

  rerender(
    <TestForm
      options={[]}
      disabled={false}
      menuFooter={<Button onClick={onCreate}>Create fruit</Button>}
    />
  );
  expect(button).toBeEnabled();
  await userEvent.click(button);
  await userEvent.click(await screen.findByRole('button', {name: 'Create fruit'}));
  expect(onCreate).toHaveBeenCalledTimes(1);
});

function ClearableTestForm() {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {fruit: 'apple' as string | null},
    validators: {onDynamic: z.object({fruit: z.string().nullable()})},
  });
  return (
    <form.AppForm form={form}>
      <form.AppField name="fruit">
        {field => (
          <field.Layout.Stack label="Fruit">
            <field.CompactSelect
              clearable
              value={field.state.value}
              onChange={field.handleChange}
              options={OPTIONS}
            />
          </field.Layout.Stack>
        )}
      </form.AppField>
      <form.Subscribe selector={state => state.values.fruit}>
        {fruit => <output>{JSON.stringify(fruit)}</output>}
      </form.Subscribe>
    </form.AppForm>
  );
}

it('clears a single value to null', async () => {
  render(<ClearableTestForm />);
  await userEvent.click(screen.getByRole('button', {name: 'Fruit'}));
  await userEvent.click(await screen.findByRole('button', {name: 'Clear'}));
  expect(screen.getByRole('status')).toHaveTextContent('null');
});

function AutoSaveTestForm({
  multiple,
  mutationFn,
}: {
  multiple: boolean;
  mutationFn: (data: {fruit: string | string[]}) => Promise<unknown>;
}) {
  return (
    <AutoSaveForm
      name="fruit"
      schema={z.object({fruit: z.union([z.string(), z.array(z.string())])})}
      initialValue={multiple ? [] : ''}
      mutationOptions={{mutationFn}}
    >
      {field => (
        <field.Layout.Stack label="Fruit">
          {multiple ? (
            <field.CompactSelect
              multiple
              value={Array.isArray(field.state.value) ? field.state.value : []}
              onChange={field.handleChange}
              options={OPTIONS}
            />
          ) : (
            <field.CompactSelect
              value={typeof field.state.value === 'string' ? field.state.value : ''}
              onChange={field.handleChange}
              options={OPTIONS}
            />
          )}
        </field.Layout.Stack>
      )}
    </AutoSaveForm>
  );
}

it.each([false, true])('auto-saves selection (multiple: %s)', async multiple => {
  let finishSave: (value: unknown) => void = () => {};
  const mutationFn = jest.fn(
    () =>
      new Promise(resolve => {
        finishSave = resolve;
      })
  );
  render(<AutoSaveTestForm multiple={multiple} mutationFn={mutationFn} />);

  const button = screen.getByRole('button', {name: 'Fruit'});
  await userEvent.click(button);
  await userEvent.click(await screen.findByRole('option', {name: 'Apple'}));
  if (multiple) {
    expect(mutationFn).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('option', {name: 'Banana'}));
    await userEvent.keyboard('{Escape}');
  }

  await waitFor(() =>
    expect(mutationFn).toHaveBeenCalledWith(
      {fruit: multiple ? ['apple', 'banana'] : 'apple'},
      expect.anything()
    )
  );
  expect(button).toBeDisabled();
  expect(screen.getByRole('status', {name: 'Saving fruit'})).toBeInTheDocument();
  finishSave({});
  await waitFor(() => expect(button).toBeEnabled());
});
