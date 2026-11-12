import {z} from 'zod';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AutoSaveForm} from '@sentry/scraps/form';

import {RequestError} from 'sentry/utils/requestError/requestError';

const testSchema = z.object({
  testField: z.string(),
});

function createRequestError(responseJSON?: Record<string, unknown>): RequestError {
  const error = new RequestError('POST', '/test/', new Error('test'));
  if (responseJSON) {
    error.responseJSON = responseJSON;
  }
  return error;
}

async function renderFailedAutoSave(error: Error) {
  render(
    <AutoSaveForm
      name="testField"
      schema={testSchema}
      initialValue="initial"
      mutationOptions={{
        mutationFn: () => {
          throw error;
        },
      }}
    >
      {field => (
        <field.Layout.Row label="Name">
          <field.Input value={field.state.value} onChange={field.handleChange} />
          <field.Meta />
        </field.Layout.Row>
      )}
    </AutoSaveForm>
  );

  const input = screen.getByRole('textbox', {name: 'Name'});
  await userEvent.clear(input);
  await userEvent.type(input, 'new value');
  await userEvent.tab();
}

describe('SentryFormErrorProvider', () => {
  it('shows the fallback for other errors', async () => {
    await renderFailedAutoSave(new Error('network failure'));

    expect(await screen.findByText('Failed to save')).toBeInTheDocument();
  });

  it('shows a backend field error from RequestError', async () => {
    await renderFailedAutoSave(
      createRequestError({testField: ['This value is not allowed']})
    );

    expect(await screen.findByText('This value is not allowed')).toBeInTheDocument();
  });

  it('shows the fallback when RequestError has no matching field errors', async () => {
    await renderFailedAutoSave(
      createRequestError({unrelatedField: ['This error does not match a field']})
    );

    expect(await screen.findByText('Failed to save')).toBeInTheDocument();
  });

  it('shows the detail message from RequestError', async () => {
    await renderFailedAutoSave(
      createRequestError({detail: 'This account cannot make this change'})
    );

    expect(
      await screen.findByText('This account cannot make this change')
    ).toBeInTheDocument();
  });

  it('shows the fallback when RequestError has no response data', async () => {
    await renderFailedAutoSave(createRequestError());

    expect(await screen.findByText('Failed to save')).toBeInTheDocument();
  });
});
