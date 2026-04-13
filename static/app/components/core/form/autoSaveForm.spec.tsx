import {useState} from 'react';
import {expectTypeOf} from 'expect-type';
import {z} from 'zod';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AutoSaveForm} from '@sentry/scraps/form';

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
});
