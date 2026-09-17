import {Form} from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import * as Storybook from 'sentry/stories';

export default Storybook.story('Form', story => {
  story('JsonForm - fields', () => (
    <Form>
      <JsonForm
        title="Form"
        fields={[
          {
            name: 'name',
            type: 'text',
            label: 'Name',
          },
        ]}
      />
    </Form>
  ));

  story('JsonForm - forms', () => (
    <Form>
      <JsonForm
        forms={[
          {
            fields: [
              {
                name: 'name1',
                type: 'text',
                label: 'Name 1',
              },
            ],
            title: 'Form 1',
          },
          {
            fields: [
              {
                name: 'name2',
                type: 'text',
                label: 'Name 2',
              },
            ],
            title: 'Form 2',
          },
        ]}
      />
    </Form>
  ));
});
