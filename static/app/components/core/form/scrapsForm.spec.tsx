import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

function TestForm({onSubmit}: {onSubmit?: () => Promise<void>}) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      name: 'default',
    },
    onSubmit: onSubmit ? async () => onSubmit() : undefined,
  });

  return (
    <form.AppForm form={form}>
      <form.AppField name="name">
        {field => (
          <input
            value={field.state.value}
            onChange={e => field.handleChange(e.target.value)}
          />
        )}
      </form.AppField>
      <form.SubmitButton>Save</form.SubmitButton>
    </form.AppForm>
  );
}

describe('SubmitButton', () => {
  it('is not disabled when form has default values', () => {
    render(<TestForm />);

    expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();
  });

  it('is disabled and shows busy state while submitting', async () => {
    let resolveSubmit!: () => void;
    const submitPromise = () =>
      new Promise<void>(resolve => {
        resolveSubmit = resolve;
      });

    render(<TestForm onSubmit={submitPromise} />);

    const button = screen.getByRole('button', {name: 'Save'});
    await userEvent.click(button);

    // Button should be busy and disabled while submitting
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-busy', 'true');
    });
    expect(button).toBeDisabled();

    // Resolve the submit
    act(() => {
      resolveSubmit();
    });

    // Button should no longer be busy
    await waitFor(() => {
      expect(button).not.toHaveAttribute('aria-busy', 'true');
    });
    expect(button).toBeEnabled();
  });
});
