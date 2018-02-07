import React from 'react';
import PropTypes from 'prop-types';
import {mount} from 'enzyme';

import ProjectPlugins from 'app/views/projectPlugins';
import {fetchPlugins, enablePlugin, disablePlugin} from 'app/actionCreators/plugins';

jest.mock('app/actionCreators/plugins');

describe('ProjectPluginsContainer', function() {
  let org, project, plugins, wrapper;

  beforeEach(function() {
    org = TestStubs.Organization();
    project = TestStubs.Project();
    plugins = TestStubs.Plugins();

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
      <ProjectPlugins params={{orgId: org.slug, projectId: project.slug}} />,
      {
        context: {
          router: TestStubs.router(),
        },

        childContextTypes: {
          router: PropTypes.object,
        },
      }
    );
  });

  it('calls `fetchPlugins` action creator after mount', function() {
    expect(fetchPlugins).toHaveBeenCalled();
  });

  it('calls `enablePlugin` action creator when enabling plugin', function() {
    let onChange = wrapper.find('ProjectPlugins').prop('onChange');

    expect(enablePlugin).not.toHaveBeenCalled();

    onChange('pluginId', true);

    expect(enablePlugin).toHaveBeenCalled();
  });

  it('calls `disablePlugin` action creator when disabling plugin', function() {
    let onChange = wrapper.find('ProjectPlugins').prop('onChange');

    expect(disablePlugin).not.toHaveBeenCalled();

    onChange('pluginId', false);

    expect(disablePlugin).toHaveBeenCalled();
  });
});
