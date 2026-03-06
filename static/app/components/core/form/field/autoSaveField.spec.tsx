import {Fragment} from 'react';
import {z} from 'zod';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AutoSaveField} from '@sentry/scraps/form';

const testSchema = z.object({
  fieldA: z.string(),
  fieldB: z.string(),
});

const noopMutation = {
  mutationFn: (data: Partial<z.infer<typeof testSchema>>) => Promise.resolve(data),
};

describe('AutoSaveField form wrapping', () => {
  it('auto-wraps children in a form element when render is not called', () => {
    render(
      <AutoSaveField
        name="fieldA"
        schema={testSchema}
        initialValue=""
        mutationOptions={noopMutation}
      >
        {field => <field.Input value={field.state.value} onChange={field.handleChange} />}
      </AutoSaveField>
    );

    expect(document.querySelectorAll('form')).toHaveLength(1);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('produces sibling forms (not nested) when render is called explicitly', () => {
    render(
      <AutoSaveField
        name="fieldA"
        schema={testSchema}
        initialValue=""
        mutationOptions={noopMutation}
      >
        {(fieldA, renderA) => (
          <Fragment>
            {renderA(
              <fieldA.Input value={fieldA.state.value} onChange={fieldA.handleChange} />
            )}
            <AutoSaveField
              name="fieldB"
              schema={testSchema}
              initialValue=""
              mutationOptions={noopMutation}
            >
              {fieldB => (
                <fieldB.Input value={fieldB.state.value} onChange={fieldB.handleChange} />
              )}
            </AutoSaveField>
          </Fragment>
        )}
      </AutoSaveField>
    );

    const forms = document.querySelectorAll('form');
    expect(forms).toHaveLength(2);

    // Ensure forms are siblings, not nested
    for (const form of forms) {
      expect(form.querySelectorAll('form')).toHaveLength(0);
    }

    expect(screen.getAllByRole('textbox')).toHaveLength(2);
  });
});
