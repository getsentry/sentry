import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectPluginDetailsContainer, {
  ProjectPluginDetails,
} from 'app/views/settings/projectPlugins/details';

jest.mock('jquery');

describe('ProjectPluginDetails', function () {
  let component;
  const routerContext = TestStubs.routerContext();
  const {organization, project} = routerContext.context;
  const org = organization;
  const plugins = TestStubs.Plugins();
  const plugin = TestStubs.Plugin();
  const pluginId = plugin.id;

  beforeAll(function () {
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/`,
      method: 'GET',
      body: plugins,
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/${pluginId}/`,
      method: 'DELETE',
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/${pluginId}/`,
      method: 'GET',
      body: plugin,
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/${pluginId}/`,
      method: 'POST',
      body: {
        ...plugin,
        config: [{value: 'default'}],
      },
    });

    component = mountWithTheme(
      <ProjectPluginDetailsContainer
        organization={org}
        project={project}
        params={{orgId: org.slug, projectId: project.slug, pluginId: 'amazon-sqs'}}
        location={TestStubs.location()}
      />,
      routerContext
    );
  });

  afterAll(function () {
    // eslint-disable-next-line no-console
    console.info.restore();
  });

  it('renders', function () {
    expect(component).toSnapshot();
  });

  it('resets plugin', function () {
    // Test component instead of container so that we can access state
    const wrapper = mountWithTheme(
      <ProjectPluginDetails
        organization={org}
        project={project}
        plugins={TestStubs.Plugins()}
        params={{orgId: org.slug, projectId: project.slug, pluginId: 'amazon-sqs'}}
        location={TestStubs.location()}
      />,
      routerContext
    );

    const btn = wrapper.find('button').at(1);
    btn.simulate('click');
    expect(wrapper.state().pluginDetails.config[0].value).toBe('default');
  });

  it('enables/disables plugin', function (done) {
    const btn = component.find('button').first();
    expect(btn.text()).toBe('Enable Plugin');

    btn.simulate('click');

    setTimeout(() => {
      try {
        component.update();
        expect(btn.text()).toBe('Disable Plugin');
        done();
      } catch (err) {
        done(err);
      }
    }, 1);
  });
});
