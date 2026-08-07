import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import type {
  IntegrationProvider,
  OrganizationIntegration,
} from 'sentry/types/integrations';
import ConfigureIntegration from 'sentry/views/settings/organizationIntegrations/configureIntegration';

describe('ConfigureIntegration settings tab', () => {
  const org = OrganizationFixture({
    access: ['org:integrations', 'org:write'],
  });
  const integrationId = '1';

  function mockRequests(
    integration: OrganizationIntegration,
    provider: IntegrationProvider = GitHubIntegrationProviderFixture({
      features: ['stacktrace-link'],
    })
  ) {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/config/integrations/`,
      body: {
        providers: [provider],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/${integrationId}/`,
      body: integration,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/code-mappings/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/repos/`,
      body: [],
    });
  }

  function renderConfigure() {
    return render(<ConfigureIntegration />, {
      organization: org,
      initialRouterConfig: {
        location: {
          pathname: `/settings/${org.slug}/integrations/github/${integrationId}/`,
          query: {},
        },
        route: '/settings/:orgId/integrations/:providerKey/:integrationId/',
      },
    });
  }

  const githubProvider = OrganizationIntegrationsFixture().provider;

  it('hides the Settings tab when there is no settings content', async () => {
    mockRequests(
      OrganizationIntegrationsFixture({
        provider: {...githubProvider, key: 'github'},
        configOrganization: [],
      })
    );

    renderConfigure();

    expect(await screen.findByRole('tab', {name: 'Code Mappings'})).toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'Settings'})).not.toBeInTheDocument();
  });

  it('shows the Settings tab when there is organization config', async () => {
    mockRequests(
      OrganizationIntegrationsFixture({
        provider: {...githubProvider, key: 'github'},
        configOrganization: [
          {
            name: 'toggle',
            type: 'boolean',
            label: 'Toggle',
          },
        ],
      })
    );

    renderConfigure();

    expect(await screen.findByRole('tab', {name: 'Settings'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Code Mappings'})).toBeInTheDocument();
  });
});

describe('ConfigureIntegration mapping removals', () => {
  const integrationId = '1';
  const mappings = {
    '10000': {on_resolve: '1', on_unresolve: '2'},
    '10001': {on_resolve: '3', on_unresolve: '4'},
  };
  const choiceMapper = {
    name: 'sync_status_forward',
    type: 'choice_mapper' as const,
    label: 'Status Mapping',
    addButtonText: 'Add Project',
    addDropdown: {
      items: [
        {value: '10000', label: 'Project A'},
        {value: '10001', label: 'Project B'},
      ],
    },
    columnLabels: {
      on_resolve: 'When Resolved',
      on_unresolve: 'When Unresolved',
    },
    mappedColumnLabel: 'Project',
    mappedSelectors: {
      on_resolve: {
        choices: [
          ['1', 'Open'],
          ['3', 'To Do'],
        ] as Array<[string, string]>,
        placeholder: 'Select resolved status',
      },
      on_unresolve: {
        choices: [
          ['2', 'Closed'],
          ['4', 'Done'],
        ] as Array<[string, string]>,
        placeholder: 'Select unresolved status',
      },
    },
  };

  function setup({
    providerKey = 'jira',
    features = [],
    configData = {sync_status_forward: mappings},
  }: {
    configData?: Record<string, unknown>;
    features?: string[];
    providerKey?: string;
  } = {}) {
    const organization = OrganizationFixture({
      access: ['org:integrations', 'org:write'],
      features,
    });
    const provider = GitHubIntegrationProviderFixture({
      key: providerKey,
      slug: providerKey,
      name: providerKey === 'jira' ? 'Jira' : 'GitHub',
      features: [],
    });
    const integration = OrganizationIntegrationsFixture({
      id: integrationId,
      provider: {
        ...OrganizationIntegrationsFixture().provider,
        key: providerKey,
        slug: providerKey,
        name: provider.name,
        features: [],
      },
      configOrganization: [choiceMapper],
      configData,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers: [provider]},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integrationId}/`,
      body: integration,
    });
    const postRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integrationId}/`,
      method: 'POST',
      body: {},
    });

    render(<ConfigureIntegration />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/integrations/${providerKey}/${integrationId}/`,
          query: {},
        },
        route: '/settings/:orgId/integrations/:providerKey/:integrationId/',
      },
    });

    return postRequest;
  }

  async function deleteSecondMapping() {
    const deleteButtons = await screen.findAllByRole('button', {name: 'Delete'});
    await userEvent.click(deleteButtons[1]!);
  }

  it('uses the legacy full replacement payload when the feature is disabled', async () => {
    const postRequest = setup();

    await deleteSecondMapping();

    await waitFor(() =>
      expect(postRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {sync_status_forward: {'10000': mappings['10000']}},
        })
      )
    );
  });

  it('appends a removal entry for a removed mapping', async () => {
    const postRequest = setup({features: ['jira-explicit-mapping-removals']});

    await deleteSecondMapping();

    await waitFor(() =>
      expect(postRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            sync_status_forward: {
              '10000': mappings['10000'],
              '10001': null,
            },
          },
        })
      )
    );
  });

  it('does not have explicit removals for a non-Jira provider', async () => {
    const postRequest = setup({
      providerKey: 'github',
      features: ['jira-explicit-mapping-removals'],
    });

    await deleteSecondMapping();

    await waitFor(() =>
      expect(postRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {sync_status_forward: {'10000': mappings['10000']}},
        })
      )
    );
  });

  it('sends all current mappings as objects when updating a mapping', async () => {
    const postRequest = setup({features: ['jira-explicit-mapping-removals']});

    await selectEvent.select(await screen.findByText('Open'), 'To Do');

    await waitFor(() =>
      expect(postRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            sync_status_forward: {
              '10000': {on_resolve: '3', on_unresolve: '2'},
              '10001': mappings['10001'],
            },
          },
        })
      )
    );
  });

  it('does not add removals when previous mapping data is missing', async () => {
    const postRequest = setup({
      features: ['jira-explicit-mapping-removals'],
      configData: {},
    });

    await userEvent.click(await screen.findByText('Add Project'));
    await userEvent.click(await screen.findByRole('option', {name: 'Project A'}));
    const form = screen.getByTestId(/sync_status_forward.*auto-save/);
    await selectEvent.select(within(form).getByText('Select resolved status'), 'Open');
    await selectEvent.select(
      within(form).getByText('Select unresolved status'),
      'Closed'
    );

    await waitFor(() =>
      expect(postRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            sync_status_forward: {
              '10000': {on_resolve: '1', on_unresolve: '2'},
            },
          },
        })
      )
    );
  });
});
