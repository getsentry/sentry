import {getByRole, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {disablePlugin, enablePlugin, fetchPlugins} from 'sentry/actionCreators/plugins';
import {ProjectPluginsContainer} from 'sentry/views/settings/projectPlugins';

jest.mock('sentry/actionCreators/plugins', () => ({
  fetchPlugins: jest.fn().mockResolvedValue([]),
  enablePlugin: jest.fn(),
  disablePlugin: jest.fn(),
}));

describe('ProjectPluginsContainer', function () {
  let org, project, plugins, params, organization;

  beforeEach(function () {
    org = TestStubs.Organization();
    project = TestStubs.Project();
    plugins = TestStubs.Plugins([
      {
        enabled: true,
        id: 'disableable plugin',
        name: 'Disableable Plugin',
        slug: 'disableable plugin',
        canDisable: true,
      },
    ]);
    params = {
      orgId: org.slug,
      projectId: project.slug,
    };
    organization = {
      id: org.slug,
      features: [],
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/`,
      method: 'GET',
      body: org,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/`,
      method: 'GET',
      body: plugins,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/amazon-sqs/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/github/`,
      method: 'DELETE',
    });
    render(
      <ProjectPluginsContainer
        plugins={{plugins, loading: false}}
        params={params}
        organization={organization}
      />
    );
  });

  it('calls `fetchPlugins` action creator after mount', function () {
    expect(fetchPlugins).toHaveBeenCalled();
  });

  it('calls `enablePlugin` action creator when enabling plugin', async function () {
    const pluginItem = (await screen.findByText('Amazon SQS')).parentElement.parentElement
      .parentElement;
    const button = getByRole(pluginItem, 'checkbox');

    expect(enablePlugin).not.toHaveBeenCalled();

    userEvent.click(button);

    expect(enablePlugin).toHaveBeenCalled();
  });

  it('calls `disablePlugin` action creator when disabling plugin', async function () {
    const pluginItem = (await screen.findByText('Disableable Plugin')).parentElement
      .parentElement.parentElement;
    const button = getByRole(pluginItem, 'checkbox');

    expect(disablePlugin).not.toHaveBeenCalled();

    userEvent.click(button);

    expect(disablePlugin).toHaveBeenCalled();
  });
});
