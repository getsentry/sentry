import {Fragment} from 'react';
import {z} from 'zod';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';
import {AutoSaveForm, defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Grid} from '@sentry/scraps/layout';

const schema = z.object({
  scopes: z.array(z.string()).min(1, 'Select at least one scope'),
});

function TestForm({
  defaultValue = [],
  disabled,
  disableFirst = false,
  onSubmit = () => {},
}: {
  defaultValue?: string[];
  disableFirst?: boolean;
  disabled?: boolean | string;
  onSubmit?: (value: {scopes: string[]}) => void;
}) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {scopes: defaultValue},
    validators: {onDynamic: schema},
    onSubmit: ({value}) => onSubmit(value),
  });

  return (
    <form.AppForm form={form}>
      <form.AppField name="scopes">
        {field => (
          <field.Checkbox.Group
            value={field.state.value}
            onChange={field.handleChange}
            disabled={disabled}
          >
            <field.Layout.Stack label="Scopes" hintText="Select permissions" required>
              <Grid columns="repeat(2, 1fr)">
                <field.Checkbox.Item value="read" disabled={disableFirst}>
                  Read
                </field.Checkbox.Item>
                <field.Checkbox.Item value="write">Write</field.Checkbox.Item>
              </Grid>
            </field.Layout.Stack>
          </field.Checkbox.Group>
        )}
      </form.AppField>
      <form.SubmitButton>Save</form.SubmitButton>
    </form.AppForm>
  );
}

function AutoSaveTestForm({
  mutationFn,
}: {
  mutationFn: (value: {scopes: string[]}) => Promise<{scopes: string[]}>;
}) {
  return (
    <AutoSaveForm
      name="scopes"
      schema={schema}
      initialValue={['read']}
      mutationOptions={{mutationFn}}
    >
      {field => (
        <field.Checkbox.Group value={field.state.value} onChange={field.handleChange}>
          <field.Layout.Stack label="Scopes">
            <field.Checkbox.Item value="read">Read</field.Checkbox.Item>
            <field.Checkbox.Item value="write">Write</field.Checkbox.Item>
          </field.Layout.Stack>
        </field.Checkbox.Group>
      )}
    </AutoSaveForm>
  );
}

function blurDisabledCheckbox(checkbox: HTMLElement) {
  // JSDOM does not emit blur or move focus when a focused input is disabled.
  act(() => {
    checkbox.dispatchEvent(new FocusEvent('blur'));
    document.body.tabIndex = -1;
    document.body.focus();
    document.body.removeAttribute('tabindex');
  });
}

describe('Checkbox.Group', () => {
  it('names the group and associates each checkbox with its label and hint', async () => {
    render(<TestForm />);

    const group = screen.getByRole('group', {name: 'Scopes'});
    const read = within(group).getByRole('checkbox', {name: 'Read'});
    const write = within(group).getByRole('checkbox', {name: 'Write'});

    expect(read.id).not.toBe(write.id);
    expect(read).toHaveAccessibleDescription('Select permissions');
    expect(write).toHaveAccessibleDescription('Select permissions');

    await userEvent.click(screen.getByText('Read'));
    expect(read).toBeChecked();
    expect(write).not.toBeChecked();
  });

  it('adds and removes selections while preserving values without a rendered item', async () => {
    const onSubmit = jest.fn();
    render(<TestForm defaultValue={['unlisted']} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('checkbox', {name: 'Read'}));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Write'}));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Read'}));
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({scopes: ['unlisted', 'write']})
    );
  });

  it('focuses the first enabled checkbox when group validation fails', async () => {
    const onSubmit = jest.fn();
    render(<TestForm disableFirst onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(await screen.findByText('Select at least one scope')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Write'})).toHaveFocus();
    expect(screen.getByRole('checkbox', {name: 'Write'})).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables all items and shows the group disabled reason once', async () => {
    render(<TestForm disabled="Permissions are locked" />);

    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox).toBeDisabled();
    }
    await userEvent.hover(screen.getByRole('img', {name: 'Disabled'}));
    expect(await screen.findByText('Permissions are locked')).toBeInTheDocument();
  });

  it('focuses the first enabled checkbox and highlights the row for a hash link', () => {
    const {router} = render(<TestForm disableFirst />);
    screen.getByRole('group', {name: 'Scopes'}).scrollIntoView = jest.fn();

    act(() => {
      router.navigate('/#scopes');
    });

    expect(screen.getByRole('checkbox', {name: 'Write'})).toHaveFocus();
    expect(
      screen.getByRole('checkbox', {name: 'Write'}).closest('#scopes')
    ).toHaveAttribute('data-highlight', '');
  });

  it('saves changes immediately and disables all items while saving', async () => {
    const mutationFn = jest.fn(() => new Promise<{scopes: string[]}>(() => {}));
    render(<AutoSaveTestForm mutationFn={mutationFn} />);

    await userEvent.click(screen.getByRole('checkbox', {name: 'Write'}));

    expect(
      await screen.findByRole('status', {name: 'Saving scopes'})
    ).toBeInTheDocument();
    expect(mutationFn).toHaveBeenCalledWith(
      {scopes: ['read', 'write']},
      expect.anything()
    );
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox).toBeDisabled();
    }
  });

  it.each(['succeeds', 'fails'])(
    'restores the focused checkbox after auto-save %s',
    async outcome => {
      const pendingSave = Promise.withResolvers<{scopes: string[]}>();
      render(<AutoSaveTestForm mutationFn={() => pendingSave.promise} />);

      const checkbox = screen.getByRole('checkbox', {name: 'Write'});
      await userEvent.tab();
      await userEvent.tab();
      expect(checkbox).toHaveFocus();
      await userEvent.keyboard(' ');
      await waitFor(() => expect(checkbox).toBeDisabled());

      blurDisabledCheckbox(checkbox);
      expect(document.body).toHaveFocus();

      if (outcome === 'succeeds') {
        pendingSave.resolve({scopes: ['read', 'write']});
      } else {
        pendingSave.reject(new Error('Could not save'));
      }

      await waitFor(() => expect(checkbox).toBeEnabled());
      expect(checkbox).toHaveFocus();
    }
  );

  it('keeps focus on another control when auto-save completes', async () => {
    const pendingSave = Promise.withResolvers<{scopes: string[]}>();
    render(
      <Fragment>
        <AutoSaveTestForm mutationFn={() => pendingSave.promise} />
        <Button>Other action</Button>
      </Fragment>
    );

    const checkbox = screen.getByRole('checkbox', {name: 'Write'});
    await userEvent.click(checkbox);
    await waitFor(() => expect(checkbox).toBeDisabled());
    blurDisabledCheckbox(checkbox);
    const otherAction = screen.getByRole('button', {name: 'Other action'});
    await userEvent.click(otherAction);

    pendingSave.resolve({scopes: ['read', 'write']});

    await waitFor(() => expect(checkbox).toBeEnabled());
    expect(otherAction).toHaveFocus();
  });

  it('restores the saved selection when auto-save fails', async () => {
    const mutationFn = jest.fn(() => Promise.reject(new Error('Could not save')));
    render(<AutoSaveTestForm mutationFn={mutationFn} />);

    await userEvent.click(screen.getByRole('checkbox', {name: 'Write'}));

    await waitFor(() => expect(mutationFn).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole('checkbox', {name: 'Write'})).not.toBeChecked()
    );
    expect(screen.getByRole('checkbox', {name: 'Read'})).toBeChecked();
  });
});
