import {useState} from 'react';

import {Container} from '@sentry/scraps/layout/container';
import {Grid} from '@sentry/scraps/layout/grid';
import {Heading} from '@sentry/scraps/text';

import Form from 'sentry/components/forms/form';
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

  story('JsonForm - collapsible field w/ callbacks', () => {
    const [logs, setLogs] = useState<Array<[string, any]>>([]);

    return (
      <Grid columns="repeat(2, 1fr)" gap="md">
        <Form
          onFieldChange={(...args) => {
            setLogs(prev => [...prev, ['onFieldChange', args]]);
          }}
        >
          <JsonForm
            fields={[
              {
                name: 'name1',
                type: 'text',
                label: 'Name 1',
              },
              {
                name: '',
                type: 'collapsible',
                label: 'additional field(s)',
                fields: [
                  {
                    name: 'name2',
                    type: 'text',
                    label: 'Name 2',
                  },
                ],
              },
            ]}
          />
        </Form>
        <Container>
          <Heading as="h2">Callbacks</Heading>
          <ol>
            {logs.map((log, i) => (
              <li key={i}>
                <pre>{JSON.stringify(log)}</pre>
              </li>
            ))}
          </ol>
        </Container>
      </Grid>
    );
  });
});
