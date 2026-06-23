import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigureIntegration from 'sentry/views/settings/organizationIntegrations/configureIntegration';

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
