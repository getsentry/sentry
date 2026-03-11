import {expectTypeOf} from 'expect-type';
import {z} from 'zod';

import {AutoSaveField} from '@sentry/scraps/form';

const testSchema = z.object({
  testField: z.string(),
});

describe('AutoSaveField', () => {
  describe('types', () => {
    it('should have data type flow towards callbacks', () => {
      function TypeTestField() {
        return (
          <AutoSaveField
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
          </AutoSaveField>
        );
      }
      void TypeTestField;
    });
  });
});
