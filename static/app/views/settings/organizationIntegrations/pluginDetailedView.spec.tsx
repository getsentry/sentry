import {OrganizationFixture} from 'sentry-fixture/organization';
import {PluginFixture} from 'sentry-fixture/plugin';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {PluginWithProjectList} from 'sentry/types/integrations';
import PluginDetailedView from 'sentry/views/settings/organizationIntegrations/pluginDetailedView';

describe('PluginDetailedView', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const plugin: PluginWithProjectList = {
    ...PluginFixture(),
    projectList: [
      {
        projectId: project.id,
        configured: true,
        enabled: true,
        projectSlug: project.slug,
        projectPlatform: project.platform ?? 'javascript',
        projectName: project.name,
      },
    ],
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/plugins/configs/`,
      method: 'GET',
      statusCode: 200,
      match: [MockApiClient.matchQuery({plugins: plugin.slug})],
      body: [plugin],
    });
  });

  it('shows the Integration name and install status', async () => {
    render(<PluginDetailedView />, {
      initialRouterConfig: {
        route: '/settings/:orgId/integrations/:integrationSlug/',
        location: {
          pathname: `/settings/${organization.slug}/integrations/${plugin.slug}/`,
        },
      },
      organization,
    });

    expect(await screen.findByText(plugin.name)).toBeInTheDocument();
    expect(screen.getByText('Installed')).toBeInTheDocument();
  });

  it('view configurations', async () => {
    render(<PluginDetailedView />, {
      initialRouterConfig: {
        route: '/settings/:orgId/integrations/:integrationSlug/',
        location: {
          pathname: `/settings/${organization.slug}/integrations/${plugin.slug}/`,
          query: {tab: 'configurations'},
        },
      },
      organization,
    });

    expect(await screen.findByText(plugin.name)).toBeInTheDocument();
    expect(screen.getByTestId('installed-plugin')).toBeInTheDocument();
  });
});
