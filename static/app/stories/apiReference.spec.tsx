import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {APIReference} from 'sentry/stories/apiReference';

describe('APIReference', () => {
  it('renders compact documentation and keeps inherited props searchable', async () => {
    render(
      <APIReference
        componentProps={{
          displayName: 'Example',
          description: 'An example component.',
          props: {
            label: {
              name: 'label',
              description: 'The visible label.',
              required: true,
              type: {name: 'string'},
              parent: {name: 'ExampleProps', fileName: './example.tsx'},
            },
            role: {
              name: 'role',
              description: 'The ARIA role.',
              required: false,
              type: {name: 'enum', raw: 'AriaRole'},
              parent: {
                name: 'HTMLAttributes',
                fileName: './node_modules/@types/react/index.d.ts',
              },
            },
          },
        }}
      />
    );

    expect(screen.getByText('An example component.')).toBeInTheDocument();
    expect(screen.getByText('The visible label.')).toBeInTheDocument();
    expect(screen.getByText('string')).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.queryByText('The ARIA role.')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Expand'}));
    expect(screen.getByText('The ARIA role.')).toBeInTheDocument();
    expect(screen.getByText('AriaRole')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Search props'), 'role');
    expect(screen.getByText('The ARIA role.')).toBeInTheDocument();
    expect(screen.queryByText('The visible label.')).not.toBeInTheDocument();
  });
});
