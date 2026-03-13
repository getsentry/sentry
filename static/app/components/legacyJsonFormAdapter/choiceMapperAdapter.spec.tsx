import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {type JsonFormAdapterFieldConfig} from './types';
import {LegacyJsonFormAdapter} from './';

function renderField(fieldConfig: JsonFormAdapterFieldConfig, initialValue?: unknown) {
  const org = OrganizationFixture();
  const mutationOptions = {
    mutationFn: jest.fn().mockResolvedValue({}),
  };

  render(
    <LegacyJsonFormAdapter
      field={fieldConfig}
      initialValue={initialValue}
      mutationOptions={mutationOptions}
    />,
    {organization: org}
  );

  return {mutationOptions};
}

describe('ChoiceMapperAdapter', () => {
  it('renders choice_mapper with empty value showing only Add button', async () => {
    renderField(
      {
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
      },
      {}
    );

    expect(screen.getByText('Status Mapping')).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: /Add Repo/i})).toBeInTheDocument();
    // No table headers when empty
    expect(screen.queryByText('Repository')).not.toBeInTheDocument();
  });

  it('renders choice_mapper table with existing values', async () => {
    renderField(
      {
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
      },
      {
        repo1: {on_resolve: 'closed', on_unresolve: 'open'},
      }
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
    const {mutationOptions} = renderField(
      {
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
      },
      {}
    );

    await userEvent.click(screen.getByText('Add Repo'));
    await userEvent.click(await screen.findByRole('option', {name: 'my-org/repo1'}));

    // Row should appear in the UI
    expect(await screen.findByText('my-org/repo1')).toBeInTheDocument();
    // But mutation should NOT fire — the user hasn't filled in the select yet
    expect(mutationOptions.mutationFn).not.toHaveBeenCalled();
  });

  it('choice_mapper add row then fill select triggers mutation', async () => {
    const {mutationOptions} = renderField(
      {
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
      },
      {}
    );

    // Add a row
    await userEvent.click(screen.getByText('Add Repo'));
    await userEvent.click(await screen.findByRole('option', {name: 'my-org/repo1'}));
    expect(await screen.findByText('my-org/repo1')).toBeInTheDocument();

    // Now fill in the select — this should trigger mutation
    await userEvent.click(screen.getByText('Select...'));
    await userEvent.click(await screen.findByText('Closed'));

    await waitFor(() => {
      expect(mutationOptions.mutationFn).toHaveBeenCalledWith({
        status_mapping: {repo1: {on_resolve: 'closed'}},
      });
    });
  });

  it('choice_mapper does not submit until all columns in every row are filled', async () => {
    const {mutationOptions} = renderField(
      {
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
      },
      {}
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
      expect(mutationOptions.mutationFn).toHaveBeenCalledWith({
        status_mapping: {repo1: {on_resolve: 'closed', on_unresolve: 'reopened'}},
      });
    });
  });

  it('choice_mapper remove row triggers mutation', async () => {
    const {mutationOptions} = renderField(
      {
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
      },
      {
        repo1: {on_resolve: 'closed'},
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    await waitFor(() => {
      expect(mutationOptions.mutationFn).toHaveBeenCalledWith({
        status_mapping: {},
      });
    });
  });

  it('choice_mapper update cell value triggers mutation', async () => {
    const {mutationOptions} = renderField(
      {
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
      },
      {
        repo1: {on_resolve: 'closed'},
      }
    );

    // Click the current value to open the select menu
    await userEvent.click(screen.getByText('Closed'));
    // Select the new value from the dropdown menu
    await userEvent.click(await screen.findByText('Open'));

    await waitFor(() => {
      expect(mutationOptions.mutationFn).toHaveBeenCalledWith({
        status_mapping: {repo1: {on_resolve: 'open'}},
      });
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

    renderField(
      {
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
      },
      {}
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

  it('choice_mapper disables controls while mutation is in flight', async () => {
    let resolveMutation!: () => void;
    const mutationOptions = {
      mutationFn: jest.fn(
        () => new Promise<void>(resolve => (resolveMutation = resolve))
      ),
    };

    const org = OrganizationFixture();
    render(
      <LegacyJsonFormAdapter
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

    // Verify controls are initially enabled
    expect(await screen.findByRole('button', {name: 'Delete'})).toBeEnabled();

    // Change a value to trigger mutation
    await userEvent.click(screen.getByText('Closed'));
    await userEvent.click(await screen.findByText('Open'));

    // Mutation should be called but not resolved
    await waitFor(() => {
      expect(mutationOptions.mutationFn).toHaveBeenCalled();
    });

    // Controls should be disabled while mutation is pending
    expect(screen.getByRole('button', {name: 'Delete'})).toBeDisabled();

    // Resolve the mutation
    resolveMutation();

    // Controls should be re-enabled
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Delete'})).toBeEnabled();
    });
  });
});
