import {useState} from 'react';
import {expectTypeOf} from 'expect-type';
import {z} from 'zod';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AutoSaveForm} from '@sentry/scraps/form';

import {RequestError} from 'sentry/utils/requestError/requestError';

const testSchema = z.object({
  testField: z.string(),
});

describe('AutoSaveForm', () => {
  describe('types', () => {
    it('should have data type flow towards callbacks', () => {
      function TypeTestField() {
        return (
          <AutoSaveForm
            name="testField"
            schema={testSchema}
            initialValue=""
            mutationOptions={{
              onMutate: variables => {
                expectTypeOf(variables).toEqualTypeOf<{testField: string}>();
                return {
                  context: true,
                };
              },
              mutationFn: data => Promise.resolve(data.testField),
              onSuccess: data => {
                expectTypeOf(data).toEqualTypeOf<string>();
              },
              onError: (error, variables, context) => {
                expectTypeOf(error).toEqualTypeOf<Error>();
                expectTypeOf(variables).toEqualTypeOf<{testField: string}>();
                expectTypeOf(context).toEqualTypeOf<{context: boolean} | undefined>();
              },
            }}
          >
            {field => (
              <field.Layout.Row label="Username">
                <field.Input value={field.state.value} onChange={field.handleChange} />
              </field.Layout.Row>
            )}
          </AutoSaveForm>
        );
      }
      void TypeTestField;
    });
  });

  describe('reset after save', () => {
    it('shows server-transformed value after successful save', async () => {
      // Simulates a server that uppercases the value
      function TestComponent() {
        const [serverState, setServerState] = useState('initial');

        return (
          <AutoSaveForm
            name="testField"
            schema={testSchema}
            initialValue={serverState}
            mutationOptions={{
              mutationFn: (data: {testField: string}) => {
                return Promise.resolve({testField: data.testField.toUpperCase()});
              },
              onSuccess: data => {
                setServerState(data.testField);
              },
            }}
          >
            {field => (
              <field.Layout.Row label="Name">
                <field.Input value={field.state.value} onChange={field.handleChange} />
              </field.Layout.Row>
            )}
          </AutoSaveForm>
        );
      }

      render(<TestComponent />);

      const input = screen.getByRole('textbox', {name: 'Name'});
      expect(input).toHaveValue('initial');

      // Type a lowercase value and blur to trigger auto-save
      await userEvent.clear(input);
      await userEvent.type(input, 'hello');
      await userEvent.tab();

      // After save, the form should reset and show the server's uppercased value
      await waitFor(() => {
        expect(input).toHaveValue('HELLO');
      });
    });
  });

  describe('error handling', () => {
    it('shows generic error for non-RequestError', async () => {
      function TestComponent() {
        return (
          <AutoSaveForm
            name="testField"
            schema={testSchema}
            initialValue="initial"
            mutationOptions={{
              mutationFn: () => {
                throw new Error('network failure');
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
      }

      render(<TestComponent />);

      const input = screen.getByRole('textbox', {name: 'Name'});
      await userEvent.clear(input);
      await userEvent.type(input, 'new value');
      await userEvent.tab();

      expect(await screen.findByText('Failed to save')).toBeInTheDocument();
    });

    it('shows backend field error from RequestError', async () => {
      function TestComponent() {
        return (
          <AutoSaveForm
            name="testField"
            schema={testSchema}
            initialValue="initial"
            mutationOptions={{
              mutationFn: () => {
                const error = new RequestError('POST', '/test/', new Error('test'));
                error.responseJSON = {testField: ['This value is not allowed']};
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
      }

      render(<TestComponent />);

      const input = screen.getByRole('textbox', {name: 'Name'});
      await userEvent.clear(input);
      await userEvent.type(input, 'new value');
      await userEvent.tab();

      expect(await screen.findByText('This value is not allowed')).toBeInTheDocument();
    });

    it('shows generic error when RequestError has no matching field errors', async () => {
      function TestComponent() {
        return (
          <AutoSaveForm
            name="testField"
            schema={testSchema}
            initialValue="initial"
            mutationOptions={{
              mutationFn: () => {
                const error = new RequestError('POST', '/test/', new Error('test'));
                error.responseJSON = {unrelatedField: ['some error']};
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
      }

      render(<TestComponent />);

      const input = screen.getByRole('textbox', {name: 'Name'});
      await userEvent.clear(input);
      await userEvent.type(input, 'new value');
      await userEvent.tab();

      expect(await screen.findByText('Failed to save')).toBeInTheDocument();
    });

    it('shows generic error when RequestError has no responseJSON', async () => {
      function TestComponent() {
        return (
          <AutoSaveForm
            name="testField"
            schema={testSchema}
            initialValue="initial"
            mutationOptions={{
              mutationFn: () => {
                throw new RequestError('POST', '/test/', new Error('test'));
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
      }

      render(<TestComponent />);

      const input = screen.getByRole('textbox', {name: 'Name'});
      await userEvent.clear(input);
      await userEvent.type(input, 'new value');
      await userEvent.tab();

      expect(await screen.findByText('Failed to save')).toBeInTheDocument();
    });
  });
});
