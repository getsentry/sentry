import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {RequestError} from 'sentry/utils/requestError/requestError';

import {BackendJsonSubmitForm} from './backendJsonSubmitForm';

jest.mock('sentry/actionCreators/indicator');

const org = OrganizationFixture();

describe('BackendJsonSubmitForm', () => {
  const onSubmit = jest.fn().mockResolvedValue({});

  afterEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  describe('basic field rendering', () => {
    it('renders boolean field as Switch', () => {
      render(
        <BackendJsonSubmitForm
          fields={[
            {
              name: 'sync_enabled',
              type: 'boolean',
              label: 'Enable Sync',
              help: 'Toggle sync on or off',
            },
          ]}
          onSubmit={onSubmit}
          submitLabel="Save"
        />,
        {organization: org}
      );

      expect(screen.getByText('Enable Sync')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('renders text field as Input', () => {
      render(
        <BackendJsonSubmitForm
          fields={[
            {
              name: 'webhook_url',
              type: 'string',
              label: 'Webhook URL',
              default: 'https://example.com',
            },
          ]}
          onSubmit={onSubmit}
          submitLabel="Save"
        />,
        {organization: org}
      );

      expect(screen.getByText('Webhook URL')).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: /webhook url/i})).toHaveValue(
        'https://example.com'
      );
    });

    it('renders textarea field', () => {
      render(
        <BackendJsonSubmitForm
          fields={[
            {
              name: 'description',
              type: 'textarea',
              label: 'Description',
              default: 'Hello world',
            },
          ]}
          onSubmit={onSubmit}
          submitLabel="Save"
        />,
        {organization: org}
      );

      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: /description/i})).toHaveValue(
        'Hello world'
      );
    });

    it('renders select field with options', () => {
      render(
        <BackendJsonSubmitForm
          fields={[
            {
              name: 'priority',
              type: 'select',
              label: 'Priority',
              choices: [
                ['high', 'High'],
                ['medium', 'Medium'],
                ['low', 'Low'],
              ],
              default: 'medium',
            },
          ]}
          onSubmit={onSubmit}
          submitLabel="Save"
        />,
        {organization: org}
      );

      expect(screen.getByText('Priority')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('renders multiple fields together', () => {
      render(
        <BackendJsonSubmitForm
          fields={[
            {name: 'title', type: 'string', label: 'Title'},
            {name: 'description', type: 'textarea', label: 'Description'},
            {
              name: 'priority',
              type: 'select',
              label: 'Priority',
              choices: [['high', 'High']],
            },
          ]}
          onSubmit={onSubmit}
          submitLabel="Save"
        />,
        {organization: org}
      );

      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Priority')).toBeInTheDocument();
    });

    it('handles disabled fields', () => {
      render(
        <BackendJsonSubmitForm
          fields={[
            {
              name: 'title',
              type: 'string',
              label: 'Title',
              disabled: true,
            },
          ]}
          onSubmit={onSubmit}
          submitLabel="Save"
        />,
        {organization: org}
      );

      expect(screen.getByRole('textbox', {name: /title/i})).toBeDisabled();
    });
  });

  describe('submission', () => {
    it('submit button calls onSubmit with all field values', async () => {
      render(
        <BackendJsonSubmitForm
          fields={[
            {name: 'title', type: 'string', label: 'Title', default: 'My Issue'},
            {
              name: 'priority',
              type: 'select',
              label: 'Priority',
              choices: [
                ['high', 'High'],
                ['low', 'Low'],
              ],
              default: 'high',
            },
          ]}
          onSubmit={onSubmit}
          submitLabel="Create"
        />,
        {organization: org}
      );

      await userEvent.click(screen.getByRole('button', {name: 'Create'}));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({title: 'My Issue', priority: 'high'})
        );
      });
    });

    it('blocks submission when required fields are empty', async () => {
      render(
        <BackendJsonSubmitForm
          fields={[{name: 'title', type: 'string', label: 'Title', required: true}]}
          onSubmit={onSubmit}
          submitLabel="Create"
        />,
        {organization: org}
      );

      await userEvent.click(screen.getByRole('button', {name: 'Create'}));

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('blocks submission when required fields contain only whitespace', async () => {
      render(
        <BackendJsonSubmitForm
          fields={[{name: 'title', type: 'string', label: 'Title', required: true}]}
          onSubmit={onSubmit}
          submitLabel="Create"
        />,
        {organization: org}
      );

      await userEvent.type(screen.getByRole('textbox', {name: /title/i}), '   ');
      await userEvent.click(screen.getByRole('button', {name: 'Create'}));

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('shows error toast on submit failure', async () => {
      const error = new RequestError('POST', '/api/test/', new Error('Bad Request'));
      error.responseJSON = {detail: 'Something went wrong'};
      const failingSubmit = jest.fn().mockRejectedValue(error);

      render(
        <BackendJsonSubmitForm
          fields={[{name: 'title', type: 'string', label: 'Title', default: 'Test'}]}
          onSubmit={failingSubmit}
          submitLabel="Create"
        />,
        {organization: org}
      );

      await userEvent.click(screen.getByRole('button', {name: 'Create'}));

      await waitFor(() => {
        expect(addErrorMessage).toHaveBeenCalledWith('Something went wrong');
      });
    });

    it('renders blank fields as nothing but disables submit', () => {
      render(
        <BackendJsonSubmitForm
          fields={[{name: 'error', type: 'blank', label: 'Error'}]}
          onSubmit={onSubmit}
          submitLabel="Create"
        />,
        {organization: org}
      );

      expect(screen.getByRole('button', {name: 'Create'})).toBeDisabled();
    });

    it('respects submitDisabled prop', () => {
      render(
        <BackendJsonSubmitForm
          fields={[{name: 'title', type: 'string', label: 'Title'}]}
          onSubmit={onSubmit}
          submitLabel="Create"
          submitDisabled
        />,
        {organization: org}
      );

      expect(screen.getByRole('button', {name: 'Create'})).toBeDisabled();
    });

    it('shows loading indicator when isLoading', () => {
      render(
        <BackendJsonSubmitForm
          fields={[{name: 'title', type: 'string', label: 'Title'}]}
          onSubmit={onSubmit}
          submitLabel="Create"
          isLoading
        />,
        {organization: org}
      );

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      expect(screen.queryByRole('textbox', {name: /title/i})).not.toBeInTheDocument();
    });

    it('supports initialValues override', () => {
      render(
        <BackendJsonSubmitForm
          fields={[
            {
              name: 'title',
              type: 'string',
              label: 'Title',
              default: 'Default Title',
            },
          ]}
          initialValues={{title: 'Overridden Title'}}
          onSubmit={onSubmit}
          submitLabel="Create"
        />,
        {organization: org}
      );

      expect(screen.getByRole('textbox', {name: /title/i})).toHaveValue(
        'Overridden Title'
      );
    });

    it('renders footer with SubmitButton when footer prop provided', () => {
      render(
        <BackendJsonSubmitForm
          fields={[{name: 'title', type: 'string', label: 'Title'}]}
          onSubmit={onSubmit}
          submitLabel="Create"
          footer={({SubmitButton, disabled}) => (
            <div data-test-id="custom-footer">
              <SubmitButton disabled={disabled}>Custom Submit</SubmitButton>
            </div>
          )}
        />,
        {organization: org}
      );

      expect(screen.getByTestId('custom-footer')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Custom Submit'})).toBeInTheDocument();
    });
  });

  describe('select variants', () => {
    it('renders multi-select field and allows multiple selections', async () => {
      render(
        <BackendJsonSubmitForm
          fields={[
            {
              name: 'labels',
              type: 'select',
              label: 'Labels',
              multiple: true,
              choices: [
                ['bug', 'bug'],
                ['feature', 'feature'],
                ['docs', 'docs'],
              ],
            },
          ]}
          onSubmit={onSubmit}
          submitLabel="Create"
        />,
        {organization: org}
      );

      await selectEvent.select(screen.getByRole('textbox', {name: 'Labels'}), 'bug');
      await selectEvent.select(screen.getByRole('textbox', {name: 'Labels'}), 'feature');

      await userEvent.click(screen.getByRole('button', {name: 'Create'}));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({labels: ['bug', 'feature']})
        );
      });
    });

    it('renders async select with static choices before search', async () => {
      render(
        <BackendJsonSubmitForm
          fields={[
            {
              name: 'repo',
              type: 'select',
              label: 'Repository',
              url: '/search',
              choices: [
                ['repo-1', 'My Repo'],
                ['repo-2', 'Other Repo'],
              ],
            },
          ]}
          onSubmit={onSubmit}
          submitLabel="Create"
        />,
        {organization: org}
      );

      // Open the select — static choices should be available
      await userEvent.click(screen.getByRole('textbox', {name: 'Repository'}));
      expect(await screen.findByText('My Repo')).toBeInTheDocument();
      expect(screen.getByText('Other Repo')).toBeInTheDocument();
    });

    it('async select fetches from URL on search', async () => {
      // Catch-all for unmatched queries
      MockApiClient.addMockResponse({
        url: '/search',
        body: [],
      });
      const searchResponse = MockApiClient.addMockResponse({
        url: '/search',
        match: [MockApiClient.matchQuery({field: 'repo', query: 'test'})],
        body: [{value: 'my-org/test-repo', label: 'test-repo'}],
      });

      render(
        <BackendJsonSubmitForm
          fields={[
            {
              name: 'repo',
              type: 'select',
              label: 'Repository',
              url: '/search',
              choices: [],
            },
          ]}
          onSubmit={onSubmit}
          submitLabel="Create"
        />,
        {organization: org}
      );

      const textbox = screen.getByRole('textbox', {name: 'Repository'});
      await userEvent.click(textbox);
      await userEvent.type(textbox, 'test');

      await waitFor(() => expect(searchResponse).toHaveBeenCalled());
      expect(await screen.findByText('test-repo')).toBeInTheDocument();
    });

    it('async select gracefully handles non-array API response', async () => {
      // Simulate backend returning HTML error page or non-array response
      MockApiClient.addMockResponse({
        url: '/search',
        body: '<html>502 Bad Gateway</html>',
      });

      render(
        <BackendJsonSubmitForm
          fields={[
            {
              name: 'repo',
              type: 'select',
              label: 'Repository',
              url: '/search',
              choices: [['fallback', 'Fallback Repo']],
            },
          ]}
          onSubmit={onSubmit}
          submitLabel="Create"
        />,
        {organization: org}
      );

      const textbox = screen.getByRole('textbox', {name: 'Repository'});
      await userEvent.click(textbox);
      await userEvent.type(textbox, '123');

      // Should not crash — falls back to empty options
      await waitFor(() => {
        // The select should still be interactive (no crash)
        expect(screen.getByRole('textbox', {name: 'Repository'})).toBeInTheDocument();
      });
    });
  });

  describe('dynamic fields', () => {
    it('calls onFieldChange when updatesForm field changes', async () => {
      const onFieldChange = jest.fn();

      render(
        <BackendJsonSubmitForm
          fields={[
            {
              name: 'project',
              type: 'select',
              label: 'Project',
              choices: [
                ['proj-1', 'Project 1'],
                ['proj-2', 'Project 2'],
              ],
              updatesForm: true,
            },
          ]}
          onSubmit={onSubmit}
          onFieldChange={onFieldChange}
          submitLabel="Create"
        />,
        {organization: org}
      );

      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Project'}),
        'Project 1'
      );

      expect(onFieldChange).toHaveBeenCalledWith('project', 'proj-1');
    });
  });

  describe('table adapter', () => {
    const tableField = {
      name: 'service_table',
      type: 'table' as const,
      label: 'Services',
      columnKeys: ['service', 'key'],
      columnLabels: {service: 'Service', key: 'Integration Key'},
      addButtonText: 'Add Service',
      confirmDeleteMessage: 'Delete this service?',
    };

    it('renders table with add button', () => {
      render(
        <BackendJsonSubmitForm
          fields={[tableField]}
          onSubmit={onSubmit}
          submitLabel="Save"
        />,
        {organization: org}
      );

      expect(screen.getByRole('button', {name: /Add Service/})).toBeInTheDocument();
    });

    it('can add a row, fill cells, and submit', async () => {
      render(
        <BackendJsonSubmitForm
          fields={[tableField]}
          onSubmit={onSubmit}
          submitLabel="Save"
        />,
        {organization: org}
      );

      await userEvent.click(screen.getByRole('button', {name: /Add Service/}));

      const inputs = screen.getAllByRole('textbox');
      await userEvent.type(inputs[0]!, 'PagerDuty');
      await userEvent.type(inputs[1]!, 'abc123');

      await userEvent.click(screen.getByRole('button', {name: 'Save'}));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            service_table: expect.arrayContaining([
              expect.objectContaining({service: 'PagerDuty', key: 'abc123'}),
            ]),
          })
        );
      });
    });

    it('can delete a row with confirmation and submit', async () => {
      renderGlobalModal();

      render(
        <BackendJsonSubmitForm
          fields={[
            {
              ...tableField,
              default: [{id: '1', service: 'Existing', key: 'xyz'}],
            },
          ]}
          onSubmit={onSubmit}
          submitLabel="Save"
        />,
        {organization: org}
      );

      await userEvent.click(screen.getByRole('button', {name: 'Delete'}));
      await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

      await userEvent.click(screen.getByRole('button', {name: 'Save'}));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({service_table: []})
        );
      });
    });
  });

  describe('choice_mapper adapter', () => {
    const choiceMapperField = {
      name: 'status_mapping',
      type: 'choice_mapper' as const,
      label: 'Status Mapping',
      addButtonText: 'Add Repo',
      addDropdown: {
        items: [
          {value: 'repo1', label: 'my-org/repo1'},
          {value: 'repo2', label: 'my-org/repo2'},
        ],
      },
      columnLabels: {on_resolve: 'When Resolved'},
      mappedColumnLabel: 'Repository',
      mappedSelectors: {
        on_resolve: {
          choices: [
            ['closed', 'Closed'],
            ['open', 'Open'],
          ] as Array<[string, string]>,
        },
      },
    };

    it('renders with add button', async () => {
      render(
        <BackendJsonSubmitForm
          fields={[choiceMapperField]}
          onSubmit={onSubmit}
          submitLabel="Save"
        />,
        {organization: org}
      );

      expect(await screen.findByText('Add Repo')).toBeInTheDocument();
    });

    it('can add a row, fill column, and submit', async () => {
      render(
        <BackendJsonSubmitForm
          fields={[choiceMapperField]}
          onSubmit={onSubmit}
          submitLabel="Save"
        />,
        {organization: org}
      );

      // Add a repo
      await userEvent.click(screen.getByText('Add Repo'));
      await userEvent.click(await screen.findByRole('option', {name: 'my-org/repo1'}));

      // Fill the column selector
      await userEvent.click(screen.getByText('Select...'));
      await userEvent.click(await screen.findByText('Closed'));

      await userEvent.click(screen.getByRole('button', {name: 'Save'}));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            status_mapping: {repo1: {on_resolve: 'closed'}},
          })
        );
      });
    });
  });

  describe('project_mapper adapter', () => {
    const projectMapperField = {
      name: 'project_mappings',
      type: 'project_mapper' as const,
      label: 'Project Mappings',
      mappedDropdown: {
        items: [
          {value: 'proj-1', label: 'Vercel Project 1'},
          {value: 'proj-2', label: 'Vercel Project 2'},
        ] as const,
        placeholder: 'Vercel project\u2026',
      },
      sentryProjects: [
        {id: 101, slug: 'sentry-frontend', name: 'Sentry Frontend'},
        {id: 102, slug: 'sentry-backend', name: 'Sentry Backend'},
      ] as const,
    };

    it('renders with dropdowns and disabled add button', () => {
      render(
        <BackendJsonSubmitForm
          fields={[projectMapperField]}
          onSubmit={onSubmit}
          submitLabel="Save"
        />,
        {organization: org}
      );

      expect(screen.getByText('Vercel project\u2026')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Add project/i})).toBeDisabled();
    });

    it('can add a mapping and submit', async () => {
      render(
        <BackendJsonSubmitForm
          fields={[projectMapperField]}
          onSubmit={onSubmit}
          submitLabel="Save"
        />,
        {organization: org}
      );

      // Select external project
      await userEvent.click(screen.getByText('Vercel project\u2026'));
      await userEvent.click(await screen.findByText('Vercel Project 1'));

      // Select Sentry project (placeholder uses unicode ellipsis, options use slug)
      await userEvent.click(screen.getByText('Sentry project\u2026'));
      await userEvent.click(await screen.findByText('sentry-frontend'));

      // Add mapping
      await userEvent.click(screen.getByRole('button', {name: /Add project/i}));

      // Submit
      await userEvent.click(screen.getByRole('button', {name: 'Save'}));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            project_mappings: [[101, 'proj-1']],
          })
        );
      });
    });
  });
});
