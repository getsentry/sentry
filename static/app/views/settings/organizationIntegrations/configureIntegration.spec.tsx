import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OpsgenieIntegrationFixture} from 'sentry-fixture/opsgenieIntegration';
import {OpsgenieIntegrationProviderFixture} from 'sentry-fixture/opsgenieIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ConfigureIntegration from 'sentry/views/settings/organizationIntegrations/configureIntegration';

describe('OpsgenieMigrationButton', () => {
  const org = OrganizationFixture({
    access: ['org:integrations', 'org:write'],
  });
  const integrationId = '1';
  it('Migrate Plugin button hits migration endpoint', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/config/integrations/`,
      body: {
        providers: [OpsgenieIntegrationProviderFixture()],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/${integrationId}/`,
      body: OpsgenieIntegrationFixture(),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/plugins/configs/`,
      body: [
        {
          id: 'opsgenie',
          name: 'Opsgenie',
          slug: 'opsgenie',
          projectList: [
            {
              projectId: 2,
              projectSlug: 'python',
              projectName: 'python',
              enabled: true,
              configured: true,
              projectPlatform: 'python',
            },
          ],
        },
      ],
    });

    const onConfirmCall = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/${integrationId}/migrate-opsgenie/`,
      method: 'PUT',
    });

    render(<ConfigureIntegration />, {
      organization: org,
      initialRouterConfig: {
        location: {
          pathname: `/settings/${org.slug}/integrations/opsgenie/${integrationId}/`,
          query: {},
        },
        route: '/settings/:orgId/integrations/:providerKey/:integrationId/',
      },
    });
    renderGlobalModal();
    expect(await screen.findByRole('button', {name: 'Migrate Plugin'})).toBeEnabled();

    await userEvent.click(screen.getByRole('button', {name: 'Migrate Plugin'}));

    expect(screen.getByRole('button', {name: 'Confirm'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(onConfirmCall).toHaveBeenCalled();
  });
});

describe('ConfigureIntegration settings tab', () => {
  const org = OrganizationFixture({
    access: ['org:integrations', 'org:write'],
  });
  const integrationId = '1';

  function mockRequests(integration: ReturnType<typeof OrganizationIntegrationsFixture>) {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/config/integrations/`,
      body: {
        providers: [GitHubIntegrationProviderFixture({features: ['stacktrace-link']})],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/${integrationId}/`,
      body: integration,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/plugins/configs/`,
      body: [],
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
