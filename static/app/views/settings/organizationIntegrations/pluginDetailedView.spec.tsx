import {OrganizationFixture} from 'sentry-fixture/organization';
import {PluginFixture} from 'sentry-fixture/plugin';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {PluginWithProjectList} from 'sentry/types/integrations';
import PluginDetailedView from 'sentry/views/settings/organizationIntegrations/pluginDetailedView';

describe('PluginDetailedView', function () {
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

  it('shows the Integration name and install status', async function () {
    const router = RouterFixture({
      params: {orgId: organization.slug, integrationSlug: plugin.slug},
    });
    render(<PluginDetailedView />, {
      organization,
      router,
      deprecatedRouterMocks: true,
    });

    expect(await screen.findByText(plugin.name)).toBeInTheDocument();
    expect(screen.getByText('Installed')).toBeInTheDocument();
  });

  it('view configurations', async function () {
    const router = RouterFixture({
      params: {orgId: organization.slug, integrationSlug: plugin.slug},
      location: {query: {tab: 'configurations'}},
    });

    render(<PluginDetailedView />, {
      router,
      organization,
      deprecatedRouterMocks: true,
    });

    expect(await screen.findByText(plugin.name)).toBeInTheDocument();
    expect(screen.getByTestId('installed-plugin')).toBeInTheDocument();
  });
});
