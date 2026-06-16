import {OrganizationFixture} from 'sentry-fixture/organization';
import {PluginFixture} from 'sentry-fixture/plugin';
import {PluginsFixture} from 'sentry-fixture/plugins';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import ProjectPluginDetails from 'sentry/views/settings/projectPlugins/details';

describe('ProjectPluginDetails', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const plugins = PluginsFixture();
  const plugin = PluginFixture();

  const initialRouterConfig = {
    location: {
      pathname: `/settings/${organization.slug}/projects/${project.slug}/settings/plugins/${plugin.id}/`,
    },
    route: '/settings/:orgId/projects/:projectId/settings/plugins/:pluginId/',
  };

  beforeAll(() => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/`,
      method: 'GET',
      body: plugins,
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/${plugin.id}/`,
      method: 'DELETE',
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/${plugin.id}/`,
      method: 'GET',
      body: plugin,
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/${plugin.id}/`,
      method: 'POST',
      body: {
        ...plugin,
        config: [{value: 'default'}],
      },
    });
  });

  it('renders', async () => {
    render(<ProjectPluginDetails />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });
    expect(await screen.findByText('Plugin Information')).toBeInTheDocument();
  });

  it('resets plugin', async () => {
    jest.spyOn(indicators, 'addSuccessMessage');
    render(<ProjectPluginDetails />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'Reset Configuration'})
    );

    await waitFor(() =>
      expect(indicators.addSuccessMessage).toHaveBeenCalledWith('Plugin was reset')
    );
  });

  it('enables/disables plugin', async () => {
    jest.spyOn(indicators, 'addSuccessMessage');
    render(<ProjectPluginDetails />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Enable Plugin'}));

    await waitFor(() =>
      expect(indicators.addSuccessMessage).toHaveBeenCalledWith('Plugin was enabled')
    );
  });
});

describe('ProjectPluginDetails - webhook routing', () => {
  const organization = OrganizationFixture({
    features: ['legacy-webhook-ui'],
  });
  const project = ProjectFixture();

  const webhookRouterConfig = {
    location: {
      pathname: `/settings/${organization.slug}/projects/${project.slug}/settings/plugins/webhooks/`,
    },
    route: '/settings/:orgId/projects/:projectId/settings/plugins/:pluginId/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('redirects to legacy-webhooks route for pluginId=webhooks', () => {
    const {router} = render(<ProjectPluginDetails />, {
      organization,
      outletContext: {project},
      initialRouterConfig: webhookRouterConfig,
    });

    expect(router.location.pathname).toBe(
      `/settings/${organization.slug}/projects/${project.slug}/legacy-webhooks/`
    );
  });

  it('does not call plugin API for webhooks route', () => {
    const pluginsMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/`,
      method: 'GET',
      body: [],
    });

    render(<ProjectPluginDetails />, {
      organization,
      outletContext: {project},
      initialRouterConfig: webhookRouterConfig,
    });

    expect(pluginsMock).not.toHaveBeenCalled();
  });
});
