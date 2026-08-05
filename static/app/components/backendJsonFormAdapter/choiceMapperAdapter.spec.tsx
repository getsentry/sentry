import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {BackendJsonAutoSaveForm} from './backendJsonAutoSaveForm';
import type {JsonFormAdapterFieldConfig} from './types';

const org = OrganizationFixture();
const mutationOptions = {
  mutationFn: jest.fn().mockResolvedValue({}),
};

/**
 * Jira-shaped field: the only provider whose backend supports explicit
 * removals, so removing a saved row tombstones it instead of dropping the key.
 */
const EXPLICIT_REMOVALS_FIELD = {
  name: 'status_mapping',
  type: 'choice_mapper',
  label: 'Status Mapping',
  addButtonText: 'Add Jira Project',
  supportsExplicitRemovals: true,
  addDropdown: {
    items: [
      {value: '10000', label: 'Project A'},
      {value: '10001', label: 'Project B'},
    ],
  },
  columnLabels: {on_resolve: 'When Resolved'},
  mappedColumnLabel: 'Jira Project',
  mappedSelectors: {
    on_resolve: {
      choices: [
        ['1', 'Open'],
        ['6', 'Closed'],
      ],
    },
  },
} satisfies JsonFormAdapterFieldConfig;

describe('ChoiceMapperAdapter', () => {
  it('renders choice_mapper with empty value showing only Add button', async () => {
    render(
      <BackendJsonAutoSaveForm
        field={{
          name: 'status_mapping',
          type: 'choice_mapper',
          label: 'Status Mapping',
          help: 'Map statuses',
          addButtonText: 'Add Repo',
          addDropdown: {
            items: [
              {value: 'repo1', label: 'my-org/repo1'},
              {value: 'repo2', label: 'my-org/repo2'},
            ],
          },
          columnLabels: {on_resolve: 'When Resolved', on_unresolve: 'When Unresolved'},
          mappedColumnLabel: 'Repository',
          mappedSelectors: {
            on_resolve: {
              choices: [
                ['closed', 'Closed'],
                ['open', 'Open'],
              ],
            },
            on_unresolve: {
              choices: [
                ['open', 'Open'],
                ['closed', 'Closed'],
              ],
            },
          },
        }}
        initialValue={{}}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    expect(screen.getByText('Status Mapping')).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: /Add Repo/i})).toBeInTheDocument();
    // No table headers when empty
    expect(screen.queryByText('Repository')).not.toBeInTheDocument();
  });

  it('renders choice_mapper table with existing values', async () => {
    render(
      <BackendJsonAutoSaveForm
        field={{
          name: 'status_mapping',
          type: 'choice_mapper',
          label: 'Status Mapping',
          addButtonText: 'Add Repo',
          addDropdown: {
            items: [
              {value: 'repo1', label: 'my-org/repo1'},
              {value: 'repo2', label: 'my-org/repo2'},
            ],
          },
          columnLabels: {on_resolve: 'When Resolved', on_unresolve: 'When Unresolved'},
          mappedColumnLabel: 'Repository',
          mappedSelectors: {
            on_resolve: {
              choices: [
                ['closed', 'Closed'],
                ['open', 'Open'],
              ],
            },
            on_unresolve: {
              choices: [
                ['open', 'Open'],
                ['closed', 'Closed'],
              ],
            },
          },
        }}
        initialValue={{
          repo1: {on_resolve: 'closed', on_unresolve: 'open'},
        }}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    // Wait for component to settle (CompactSelect popper setup)
    expect(await screen.findByRole('button', {name: /Add Repo/i})).toBeInTheDocument();
    // Column headers
    expect(screen.getByText('Repository')).toBeInTheDocument();
    expect(screen.getByText('When Resolved')).toBeInTheDocument();
    expect(screen.getByText('When Unresolved')).toBeInTheDocument();
    // Item label from valueMap
    expect(screen.getByText('my-org/repo1')).toBeInTheDocument();
    // Current values rendered in selects
    expect(screen.getByText('Closed')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    // Delete button
    expect(screen.getByRole('button', {name: 'Delete'})).toBeInTheDocument();
  });

  it('choice_mapper add row does not immediately submit', async () => {
    render(
      <BackendJsonAutoSaveForm
        field={{
          name: 'status_mapping',
          type: 'choice_mapper',
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
              ],
            },
          },
        }}
        initialValue={{}}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    await userEvent.click(screen.getByText('Add Repo'));
    await userEvent.click(await screen.findByRole('option', {name: 'my-org/repo1'}));

    // Row should appear in the UI
    expect(await screen.findByText('my-org/repo1')).toBeInTheDocument();
    // But mutation should NOT fire — the user hasn't filled in the select yet
    expect(mutationOptions.mutationFn).not.toHaveBeenCalled();
  });

  it('choice_mapper add row then fill select triggers mutation', async () => {
    render(
      <BackendJsonAutoSaveForm
        field={{
          name: 'status_mapping',
          type: 'choice_mapper',
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
              ],
            },
          },
        }}
        initialValue={{}}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    // Add a row
    await userEvent.click(screen.getByText('Add Repo'));
    await userEvent.click(await screen.findByRole('option', {name: 'my-org/repo1'}));
    expect(await screen.findByText('my-org/repo1')).toBeInTheDocument();

    // Now fill in the select — this should trigger mutation
    await userEvent.click(screen.getByText('Select...'));
    await userEvent.click(await screen.findByText('Closed'));

    await waitFor(() => {
      expect(mutationOptions.mutationFn).toHaveBeenCalledWith(
        {
          status_mapping: {repo1: {on_resolve: 'closed'}},
        },
        expect.anything()
      );
    });
  });

  it('choice_mapper does not submit until all columns in every row are filled', async () => {
    render(
      <BackendJsonAutoSaveForm
        field={{
          name: 'status_mapping',
          type: 'choice_mapper',
          label: 'Status Mapping',
          addButtonText: 'Add Repo',
          addDropdown: {
            items: [
              {value: 'repo1', label: 'my-org/repo1'},
              {value: 'repo2', label: 'my-org/repo2'},
            ],
          },
          columnLabels: {on_resolve: 'When Resolved', on_unresolve: 'When Unresolved'},
          mappedColumnLabel: 'Repository',
          mappedSelectors: {
            on_resolve: {
              choices: [
                ['closed', 'Closed'],
                ['open', 'Open'],
              ],
            },
            on_unresolve: {
              choices: [
                ['reopened', 'Reopened'],
                ['wontfix', "Won't Fix"],
              ],
            },
          },
        }}
        initialValue={{}}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    // Add a row
    await userEvent.click(screen.getByText('Add Repo'));
    await userEvent.click(await screen.findByRole('option', {name: 'my-org/repo1'}));
    expect(await screen.findByText('my-org/repo1')).toBeInTheDocument();

    // Fill only the first column — should NOT submit
    const selects = screen.getAllByText('Select...');
    await userEvent.click(selects[0]!);
    await userEvent.click(await screen.findByText('Closed'));

    expect(mutationOptions.mutationFn).not.toHaveBeenCalled();

    // Fill the second column — NOW it should submit
    await userEvent.click(screen.getByText('Select...'));
    await userEvent.click(await screen.findByText('Reopened'));

    await waitFor(() => {
      expect(mutationOptions.mutationFn).toHaveBeenCalledWith(
        {
          status_mapping: {repo1: {on_resolve: 'closed', on_unresolve: 'reopened'}},
        },
        expect.anything()
      );
    });
  });

  // Regression guard for github, github_enterprise, gitlab, vsts and jira_server:
  // without `supportsExplicitRemovals` the payload is the complete desired state,
  // so a removed row is expressed by dropping its key — never by a `null`.
  it('choice_mapper remove row drops the key when explicit removals are unsupported', async () => {
    render(
      <BackendJsonAutoSaveForm
        field={{
          name: 'status_mapping',
          type: 'choice_mapper',
          label: 'Status Mapping',
          addButtonText: 'Add Repo',
          addDropdown: {
            items: [{value: 'repo1', label: 'my-org/repo1'}],
          },
          columnLabels: {on_resolve: 'When Resolved'},
          mappedColumnLabel: 'Repository',
          mappedSelectors: {
            on_resolve: {
              choices: [
                ['closed', 'Closed'],
                ['open', 'Open'],
              ],
            },
          },
        }}
        initialValue={{repo1: {on_resolve: 'closed'}}}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    await waitFor(() => {
      expect(mutationOptions.mutationFn).toHaveBeenCalledWith(
        {
          status_mapping: {},
        },
        expect.anything()
      );
    });
    // No confirmation either — nothing is being deleted explicitly
    expect(screen.queryByRole('button', {name: 'Confirm'})).not.toBeInTheDocument();
  });

  it('choice_mapper update cell value triggers mutation', async () => {
    render(
      <BackendJsonAutoSaveForm
        field={{
          name: 'status_mapping',
          type: 'choice_mapper',
          label: 'Status Mapping',
          addButtonText: 'Add Repo',
          addDropdown: {
            items: [{value: 'repo1', label: 'my-org/repo1'}],
          },
          columnLabels: {on_resolve: 'When Resolved'},
          mappedColumnLabel: 'Repository',
          mappedSelectors: {
            on_resolve: {
              choices: [
                ['closed', 'Closed'],
                ['open', 'Open'],
              ],
            },
          },
        }}
        initialValue={{repo1: {on_resolve: 'closed'}}}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    // Click the current value to open the select menu
    await userEvent.click(screen.getByText('Closed'));
    // Select the new value from the dropdown menu
    await userEvent.click(await screen.findByText('Open'));

    await waitFor(() => {
      expect(mutationOptions.mutationFn).toHaveBeenCalledWith(
        {
          status_mapping: {repo1: {on_resolve: 'open'}},
        },
        expect.anything()
      );
    });
  });

  it('choice_mapper async search fetches results and adds row', async () => {
    const searchUrl = '/extensions/github/search/my-org/123/';

    MockApiClient.addMockResponse({
      url: searchUrl,
      body: [
        {value: 'my-org/cool-repo', label: 'my-org/cool-repo'},
        {value: 'my-org/other-repo', label: 'my-org/other-repo'},
      ],
    });

    render(
      <BackendJsonAutoSaveForm
        field={{
          name: 'status_mapping',
          type: 'choice_mapper',
          label: 'Status Mapping',
          addButtonText: 'Add GitHub Project',
          addDropdown: {
            items: [],
            url: searchUrl,
            searchField: 'repo',
            noResultsMessage: 'Could not find GitHub project',
          },
          columnLabels: {on_resolve: 'When Resolved'},
          mappedColumnLabel: 'Repository',
          mappedSelectors: {
            on_resolve: {
              choices: [
                ['closed', 'Closed'],
                ['open', 'Open'],
              ],
            },
          },
        }}
        initialValue={{}}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    // Open the dropdown
    await userEvent.click(
      await screen.findByRole('button', {name: /Add GitHub Project/i})
    );

    // Before typing, should show "Type to search"
    expect(screen.getByText('Type to search')).toBeInTheDocument();

    // Type a search query into the search input
    await userEvent.type(screen.getByRole('textbox'), 'cool');

    // Wait for search results to appear
    expect(
      await screen.findByRole('option', {name: 'my-org/cool-repo'})
    ).toBeInTheDocument();

    // Select a result
    await userEvent.click(screen.getByRole('option', {name: 'my-org/cool-repo'}));

    // Row should appear with the label
    expect(await screen.findByText('my-org/cool-repo')).toBeInTheDocument();
  });

  it('choice_mapper async search displays item value as row label', async () => {
    const searchUrl = '/extensions/github/search/my-org/123/';

    MockApiClient.addMockResponse({
      url: searchUrl,
      body: [{value: 'my-org/cool-repo', label: 'Cool Repo (friendly name)'}],
    });

    render(
      <BackendJsonAutoSaveForm
        field={{
          name: 'status_mapping',
          type: 'choice_mapper',
          label: 'Status Mapping',
          addButtonText: 'Add GitHub Project',
          addDropdown: {
            items: [],
            url: searchUrl,
            searchField: 'repo',
          },
          columnLabels: {on_resolve: 'When Resolved'},
          mappedColumnLabel: 'Repository',
          mappedSelectors: {
            on_resolve: {
              choices: [
                ['closed', 'Closed'],
                ['open', 'Open'],
              ],
            },
          },
        }}
        initialValue={{}}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    // Search and add a row
    await userEvent.click(
      await screen.findByRole('button', {name: /Add GitHub Project/i})
    );
    await userEvent.type(screen.getByRole('textbox'), 'cool');
    await userEvent.click(
      await screen.findByRole('option', {name: 'Cool Repo (friendly name)'})
    );

    // Row label should display the item value (key), not the friendly label,
    // because saved entries from the server only have the value as the key
    expect(await screen.findByText('my-org/cool-repo')).toBeInTheDocument();
    expect(screen.queryByText('Cool Repo (friendly name)')).not.toBeInTheDocument();
  });

  it('choice_mapper lazy-loads statuses via statusUrl for new rows', async () => {
    const statusUrl = '/extensions/jira/search/my-org/42/';

    MockApiClient.addMockResponse({
      url: statusUrl,
      body: [
        {value: '1', label: 'Open'},
        {value: '6', label: 'Closed'},
      ],
      match: [MockApiClient.matchQuery({field: 'status', project: '10001'})],
    });

    render(
      <BackendJsonAutoSaveForm
        field={{
          name: 'status_mapping',
          type: 'choice_mapper',
          label: 'Status Mapping',
          addButtonText: 'Add Jira Project',
          addDropdown: {
            items: [
              {value: '10000', label: 'Project A'},
              {value: '10001', label: 'Project B'},
            ],
          },
          columnLabels: {on_resolve: 'When Resolved'},
          mappedColumnLabel: 'Jira Project',
          perItemMapping: true,
          statusUrl,
          mappedSelectors: {
            '10000': {
              on_resolve: {
                choices: [
                  ['1', 'Open'],
                  ['6', 'Closed'],
                ],
              },
            },
          },
        }}
        initialValue={{
          '10000': {on_resolve: '1'},
        }}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    // Pre-populated row renders immediately
    expect(await screen.findByText('Open')).toBeInTheDocument();

    // Add a new row that isn't in mappedSelectors
    await userEvent.click(screen.getByRole('button', {name: /Add Jira Project/i}));
    await userEvent.click(await screen.findByRole('option', {name: 'Project B'}));

    // After fetch completes, the select should be interactive with fetched options
    const newSelect = await screen.findByText('Select...');
    await userEvent.click(newSelect);
    expect(await screen.findByText('Closed')).toBeInTheDocument();
  });

  it('choice_mapper does not fetch for pre-populated rows', async () => {
    const statusUrl = '/extensions/jira/search/my-org/42/';

    const mockRequest = MockApiClient.addMockResponse({
      url: statusUrl,
      body: [],
    });

    render(
      <BackendJsonAutoSaveForm
        field={{
          name: 'status_mapping',
          type: 'choice_mapper',
          label: 'Status Mapping',
          addButtonText: 'Add Jira Project',
          addDropdown: {
            items: [{value: '10000', label: 'Project A'}],
          },
          columnLabels: {on_resolve: 'When Resolved'},
          mappedColumnLabel: 'Jira Project',
          perItemMapping: true,
          statusUrl,
          mappedSelectors: {
            '10000': {
              on_resolve: {
                choices: [
                  ['1', 'Open'],
                  ['6', 'Closed'],
                ],
              },
            },
          },
        }}
        initialValue={{
          '10000': {on_resolve: '1'},
        }}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    expect(await screen.findByText('Open')).toBeInTheDocument();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('choice_mapper disables controls while mutation is in flight', async () => {
    let resolveMutation!: () => void;
    const pendingMutationOptions = {
      mutationFn: jest.fn(
        () => new Promise<void>(resolve => (resolveMutation = resolve))
      ),
    };

    render(
      <BackendJsonAutoSaveForm
        field={{
          name: 'status_mapping',
          type: 'choice_mapper',
          label: 'Status Mapping',
          addButtonText: 'Add Repo',
          addDropdown: {
            items: [{value: 'repo1', label: 'my-org/repo1'}],
          },
          columnLabels: {on_resolve: 'When Resolved'},
          mappedColumnLabel: 'Repository',
          mappedSelectors: {
            on_resolve: {
              choices: [
                ['closed', 'Closed'],
                ['open', 'Open'],
              ],
            },
          },
        }}
        initialValue={{repo1: {on_resolve: 'closed'}}}
        mutationOptions={pendingMutationOptions}
      />,
      {organization: org}
    );

    // Verify controls are initially enabled
    expect(await screen.findByRole('button', {name: 'Delete'})).toBeEnabled();

    // Change a value to trigger mutation
    await userEvent.click(screen.getByText('Closed'));
    await userEvent.click(await screen.findByText('Open'));

    // Mutation should be called but not resolved
    await waitFor(() => {
      expect(pendingMutationOptions.mutationFn).toHaveBeenCalled();
    });

    // Controls should be disabled while mutation is pending
    expect(screen.getByRole('button', {name: 'Delete'})).toBeDisabled();
    expect(screen.getByRole('button', {name: /Add Repo/i})).toBeDisabled();

    // Resolve the mutation
    resolveMutation();

    // Controls should be re-enabled
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Delete'})).toBeEnabled();
    });
    expect(screen.getByRole('button', {name: /Add Repo/i})).toBeEnabled();
  });

  describe('explicit removals', () => {
    it('removing a saved row submits a tombstone after confirmation', async () => {
      render(
        <BackendJsonAutoSaveForm
          field={EXPLICIT_REMOVALS_FIELD}
          initialValue={{'10000': {on_resolve: '1'}}}
          mutationOptions={mutationOptions}
        />,
        {organization: org}
      );
      renderGlobalModal();

      await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

      // The modal names the project being removed
      expect(
        await screen.findByText(
          "Remove the saved mapping for Project A? This can't be undone."
        )
      ).toBeInTheDocument();
      expect(mutationOptions.mutationFn).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      await waitFor(() => {
        expect(mutationOptions.mutationFn).toHaveBeenCalledWith(
          {status_mapping: {'10000': null}},
          expect.anything()
        );
      });
    });

    it('cancelling the confirmation restores the row and sends no request', async () => {
      render(
        <BackendJsonAutoSaveForm
          field={EXPLICIT_REMOVALS_FIELD}
          initialValue={{'10000': {on_resolve: '1'}}}
          mutationOptions={mutationOptions}
        />,
        {organization: org}
      );
      renderGlobalModal();

      await userEvent.click(screen.getByRole('button', {name: 'Delete'}));
      await userEvent.click(await screen.findByRole('button', {name: 'Cancel'}));

      expect(await screen.findByText('Project A')).toBeInTheDocument();
      expect(mutationOptions.mutationFn).not.toHaveBeenCalled();
    });

    it('hides the tombstoned row but keeps its siblings', async () => {
      render(
        <BackendJsonAutoSaveForm
          field={EXPLICIT_REMOVALS_FIELD}
          initialValue={{
            '10000': {on_resolve: '1'},
            '10001': {on_resolve: '6'},
          }}
          mutationOptions={mutationOptions}
        />,
        {organization: org}
      );
      renderGlobalModal();

      await userEvent.click(screen.getAllByRole('button', {name: 'Delete'})[0]!);

      await waitFor(() => {
        expect(screen.queryByText('Project A')).not.toBeInTheDocument();
      });
      expect(screen.getByText('Project B')).toBeInTheDocument();
      // Headers stay — there's still a row to label
      expect(screen.getByText('Jira Project')).toBeInTheDocument();
    });

    it('collapses the table when the only row is tombstoned', async () => {
      render(
        <BackendJsonAutoSaveForm
          field={EXPLICIT_REMOVALS_FIELD}
          initialValue={{'10000': {on_resolve: '1'}}}
          mutationOptions={mutationOptions}
        />,
        {organization: org}
      );
      renderGlobalModal();

      await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

      await waitFor(() => {
        expect(screen.queryByText('Jira Project')).not.toBeInTheDocument();
      });
      expect(screen.queryByText('Project A')).not.toBeInTheDocument();
    });

    it('keeps a pending tombstone while another row is being filled in', async () => {
      render(
        <BackendJsonAutoSaveForm
          field={EXPLICIT_REMOVALS_FIELD}
          initialValue={{'10000': {on_resolve: '1'}}}
          mutationOptions={mutationOptions}
        />,
        {organization: org}
      );
      renderGlobalModal();

      // An unfilled row holds the save back, so the tombstone stays in the value
      await userEvent.click(screen.getByRole('button', {name: /Add Jira Project/i}));
      await userEvent.click(await screen.findByRole('option', {name: 'Project B'}));

      await userEvent.click(screen.getAllByRole('button', {name: 'Delete'})[0]!);
      expect(mutationOptions.mutationFn).not.toHaveBeenCalled();

      // Filling the new row submits the tombstone alongside the upsert
      await userEvent.click(screen.getByText('Select...'));
      await userEvent.click(await screen.findByText('Closed'));

      expect(
        await screen.findByText(
          "Remove the saved mapping for Project A? This can't be undone."
        )
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      await waitFor(() => {
        expect(mutationOptions.mutationFn).toHaveBeenCalledWith(
          {status_mapping: {'10000': null, '10001': {on_resolve: '6'}}},
          expect.anything()
        );
      });
    });

    it('re-adding a tombstoned project brings the row back', async () => {
      render(
        <BackendJsonAutoSaveForm
          field={EXPLICIT_REMOVALS_FIELD}
          initialValue={{'10000': {on_resolve: '1'}}}
          mutationOptions={mutationOptions}
        />,
        {organization: org}
      );
      renderGlobalModal();

      // Park an unfilled row so the delete below doesn't submit
      await userEvent.click(screen.getByRole('button', {name: /Add Jira Project/i}));
      await userEvent.click(await screen.findByRole('option', {name: 'Project B'}));
      await userEvent.click(screen.getAllByRole('button', {name: 'Delete'})[0]!);

      await waitFor(() => {
        expect(screen.queryByText('Project A')).not.toBeInTheDocument();
      });

      // The tombstoned project is selectable again
      await userEvent.click(screen.getByRole('button', {name: /Add Jira Project/i}));
      await userEvent.click(await screen.findByRole('option', {name: 'Project A'}));

      expect(await screen.findByText('Project A')).toBeInTheDocument();
      expect(mutationOptions.mutationFn).not.toHaveBeenCalled();
    });

    it('removing a row that was never saved sends no tombstone', async () => {
      render(
        <BackendJsonAutoSaveForm
          field={EXPLICIT_REMOVALS_FIELD}
          initialValue={{'10000': {on_resolve: '1'}}}
          mutationOptions={mutationOptions}
        />,
        {organization: org}
      );
      renderGlobalModal();

      // Add a row, then remove it again before it is ever saved
      await userEvent.click(screen.getByRole('button', {name: /Add Jira Project/i}));
      await userEvent.click(await screen.findByRole('option', {name: 'Project B'}));
      await userEvent.click(screen.getAllByRole('button', {name: 'Delete'})[1]!);

      await waitFor(() => {
        expect(screen.queryByText('Project B')).not.toBeInTheDocument();
      });
      expect(screen.queryByRole('button', {name: 'Confirm'})).not.toBeInTheDocument();

      // Editing the surviving row proves the removed key is gone, not tombstoned
      await userEvent.click(screen.getByText('Open'));
      await userEvent.click(await screen.findByText('Closed'));

      await waitFor(() => {
        expect(mutationOptions.mutationFn).toHaveBeenCalledWith(
          {status_mapping: {'10000': {on_resolve: '6'}}},
          expect.anything()
        );
      });
    });

    it('keeps the row gone once the refetched value arrives', async () => {
      const {rerender} = render(
        <BackendJsonAutoSaveForm
          field={EXPLICIT_REMOVALS_FIELD}
          initialValue={{
            '10000': {on_resolve: '1'},
            '10001': {on_resolve: '6'},
          }}
          mutationOptions={mutationOptions}
        />,
        {organization: org}
      );
      renderGlobalModal();

      await userEvent.click(screen.getAllByRole('button', {name: 'Delete'})[0]!);
      await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

      await waitFor(() => {
        expect(mutationOptions.mutationFn).toHaveBeenCalled();
      });

      rerender(
        <BackendJsonAutoSaveForm
          field={EXPLICIT_REMOVALS_FIELD}
          initialValue={{'10001': {on_resolve: '6'}}}
          mutationOptions={mutationOptions}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Project A')).not.toBeInTheDocument();
      });
      expect(screen.getByText('Project B')).toBeInTheDocument();
    });

    it('stops fetching statuses once a project is tombstoned', async () => {
      const statusUrl = '/extensions/jira/search/my-org/42/';
      const statusRequest = MockApiClient.addMockResponse({
        url: statusUrl,
        body: [
          {value: '1', label: 'Open'},
          {value: '6', label: 'Closed'},
        ],
      });

      render(
        <BackendJsonAutoSaveForm
          field={{
            ...EXPLICIT_REMOVALS_FIELD,
            perItemMapping: true,
            statusUrl,
            // Project A's statuses didn't come with the config, so they're fetched
            mappedSelectors: {},
          }}
          initialValue={{'10000': {on_resolve: '1'}}}
          mutationOptions={mutationOptions}
        />,
        {organization: org}
      );
      renderGlobalModal();

      await waitFor(() => {
        expect(statusRequest).toHaveBeenCalledTimes(1);
      });

      await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

      // The tombstoned row is dropped from the lazy selector queries, so nothing
      // else is fetched for a project that is on its way out.
      await waitFor(() => {
        expect(screen.queryByText('Project A')).not.toBeInTheDocument();
      });
      expect(statusRequest).toHaveBeenCalledTimes(1);
    });
  });
});
