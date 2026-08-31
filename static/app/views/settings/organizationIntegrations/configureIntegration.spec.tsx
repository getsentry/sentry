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

  function renderConfigure(providerKey = 'github') {
    return render(<ConfigureIntegration />, {
      organization: org,
      initialRouterConfig: {
        location: {
          pathname: `/settings/${org.slug}/integrations/${providerKey}/${integrationId}/`,
          query: {},
        },
        route: '/settings/:orgId/integrations/:providerKey/:integrationId/',
      },
    });
  }

  const githubProvider = OrganizationIntegrationsFixture().provider;

  it('shows the integration name as a link in the header', async () => {
    const integration = OrganizationIntegrationsFixture({
      name: 'sentry-demos',
      domainName: 'github.com/sentry-demos',
      provider: {...githubProvider, key: 'github'},
      configOrganization: [],
    });
    mockRequests(integration);

    renderConfigure();

    expect(await screen.findByRole('link', {name: 'sentry-demos'})).toHaveAttribute(
      'href',
      'https://github.com/sentry-demos'
    );
    expect(screen.queryByText('github.com/sentry-demos')).not.toBeInTheDocument();
  });

  it('uses a full domain URL without adding another protocol', async () => {
    const integration = OrganizationIntegrationsFixture({
      name: 'Azure DevOps',
      domainName: 'https://example.visualstudio.com/',
      provider: {...githubProvider, key: 'vsts'},
      configOrganization: [],
    });
    mockRequests(
      integration,
      GitHubIntegrationProviderFixture({key: 'vsts', slug: 'vsts'})
    );

    renderConfigure('vsts');

    expect(await screen.findByRole('link', {name: 'Azure DevOps'})).toHaveAttribute(
      'href',
      'https://example.visualstudio.com/'
    );
  });

  it('shows the PagerDuty integration name without a link for a subdomain', async () => {
    const integration = OrganizationIntegrationsFixture({
      name: 'PagerDuty',
      domainName: 'example-account',
      provider: {...githubProvider, key: 'pagerduty'},
      configOrganization: [],
    });
    mockRequests(
      integration,
      GitHubIntegrationProviderFixture({key: 'pagerduty', slug: 'pagerduty'})
    );

    renderConfigure('pagerduty');

    expect(await screen.findByText('PagerDuty')).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'PagerDuty'})).not.toBeInTheDocument();
  });

  it('shows the integration name without a link when there is no domain', async () => {
    const integration = OrganizationIntegrationsFixture({
      name: 'Slack',
      domainName: null,
      provider: {...githubProvider, key: 'slack'},
      configOrganization: [],
    });
    mockRequests(
      integration,
      GitHubIntegrationProviderFixture({key: 'slack', slug: 'slack'})
    );

    renderConfigure('slack');

    expect(await screen.findByText('Slack')).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Slack'})).not.toBeInTheDocument();
  });

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

describe('ConfigureIntegration GCP re-verification', () => {
  const integrationId = '1';
  const CUSTOMER_SA = 'gcp-sentry@my-project.iam.gserviceaccount.com';

  function setup({providerKey = 'gcp'}: {providerKey?: string} = {}) {
    const organization = OrganizationFixture({
      access: ['org:integrations', 'org:write'],
    });
    const provider = GitHubIntegrationProviderFixture({
      key: providerKey,
      slug: providerKey,
      name: 'Google Cloud Platform',
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
      configOrganization: [
        {
          name: 'customer_sa_email',
          type: 'string' as const,
          label: 'Customer Service Account',
          required: true,
        },
      ],
      configData: {
        customer_sa_email: CUSTOMER_SA,
        projects: 'project-prod, project-staging',
      },
    });

    // Stand in for the stored config, so a save is visible to the refetch that
    // follows it — which is what the verification payload is built from.
    let storedConfig: Record<string, unknown> = {...integration.configData};

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers: [provider]},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integrationId}/`,
      body: () => ({...integration, configData: storedConfig}),
    });
    const saveRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integrationId}/`,
      method: 'POST',
      body: (_url: string, options: {data?: Record<string, unknown>}) => {
        storedConfig = {...storedConfig, ...options.data};
        return {};
      },
    });
    const verifyRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitoring-providers/gcp/verify-connection/`,
      method: 'POST',
      body: {connectionStatus: 'connected', projects: []},
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

    return {
      saveRequest,
      verifyRequest,
      setStoredConfig: (next: Record<string, unknown>) => {
        storedConfig = {...storedConfig, ...next};
      },
    };
  }

  async function saveNewSaEmail(value: string) {
    const field = await screen.findByRole('textbox', {name: 'Customer Service Account'});
    await userEvent.clear(field);
    await userEvent.type(field, value);
    await userEvent.tab();
  }

  it('re-runs verification with the saved settings', async () => {
    const {verifyRequest} = setup();

    await saveNewSaEmail('new-sa@my-project.iam.gserviceaccount.com');

    await waitFor(() =>
      expect(verifyRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            customerSaEmail: 'new-sa@my-project.iam.gserviceaccount.com',
            gcpProjectIds: ['project-prod', 'project-staging'],
          },
        })
      )
    );
  });

  it('builds the payload from the refetched config, not the local one', async () => {
    const {verifyRequest, setStoredConfig} = setup();

    // A sibling field was saved elsewhere, so what this render closed over is stale.
    setStoredConfig({projects: 'project-prod, project-staging, project-new'});

    await saveNewSaEmail('new-sa@my-project.iam.gserviceaccount.com');

    await waitFor(() =>
      expect(verifyRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            customerSaEmail: 'new-sa@my-project.iam.gserviceaccount.com',
            gcpProjectIds: ['project-prod', 'project-staging', 'project-new'],
          },
        })
      )
    );
  });

  it('does not re-run verification for other providers', async () => {
    const {saveRequest, verifyRequest} = setup({providerKey: 'github'});

    await saveNewSaEmail('someone@example.com');

    await waitFor(() => expect(saveRequest).toHaveBeenCalled());
    expect(verifyRequest).not.toHaveBeenCalled();
  });
});
