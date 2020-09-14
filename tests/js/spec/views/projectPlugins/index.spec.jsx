import React from 'react';

import {mount} from 'sentry-test/enzyme';

import ProjectPlugins from 'app/views/settings/projectPlugins';
import {fetchPlugins, enablePlugin, disablePlugin} from 'app/actionCreators/plugins';

jest.mock('app/actionCreators/plugins', () => ({
  fetchPlugins: jest.fn().mockResolvedValue([]),
  enablePlugin: jest.fn(),
  disablePlugin: jest.fn(),
}));

describe('ProjectPluginsContainer', function() {
  let org, project, plugins, wrapper, params, organization;
  const routerContext = TestStubs.routerContext();

  beforeEach(function() {
    org = TestStubs.Organization();
    project = TestStubs.Project();
    plugins = TestStubs.Plugins();
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
    wrapper = mount(
      <ProjectPlugins params={params} organization={organization} />,
      routerContext
    );
  });

  it('calls `fetchPlugins` action creator after mount', function() {
    expect(fetchPlugins).toHaveBeenCalled();
  });

  it('calls `enablePlugin` action creator when enabling plugin', function() {
    const onChange = wrapper.find('ProjectPlugins').prop('onChange');

    expect(enablePlugin).not.toHaveBeenCalled();

    onChange('pluginId', true);

    expect(enablePlugin).toHaveBeenCalled();
  });

  it('calls `disablePlugin` action creator when disabling plugin', function() {
    const onChange = wrapper.find('ProjectPlugins').prop('onChange');

    expect(disablePlugin).not.toHaveBeenCalled();

    onChange('pluginId', false);

    expect(disablePlugin).toHaveBeenCalled();
  });
});
