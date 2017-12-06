import React from 'react';
import {mount} from 'enzyme';
import ProjectPluginDetails from 'app/views/projectPluginDetails';

describe('ProjectPluginDetails', function() {
  let org, project, component;

  beforeEach(function() {
    org = TestStubs.Organization();
    project = TestStubs.Project();
    let plugin = TestStubs.Plugins()[0];
    let pluginId = plugin.id;

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/${pluginId}/`,
      method: 'GET',
      body: plugin,
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/${pluginId}/`,
      method: 'POST',
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/${pluginId}/reset/`,
      method: 'POST',
      body: {
        ...plugin,
        config: [{value: 'default'}],
      },
    });

    component = mount(
      <ProjectPluginDetails
        organization={org}
        project={project}
        params={{orgId: org.slug, projectId: project.slug, pluginId: 'amazon-sqs'}}
      />,
      {
        context: {
          router: TestStubs.router(),
        },
      }
    );
  });
  it('renders', function() {
    expect(component).toMatchSnapshot();
  });

  it('enables/disables plugin', function() {
    let btn = component.find('button').first();
    expect(component.state().plugin.enabled).toBe(false);
    expect(btn.text()).toBe('Enable Plugin');
    btn.simulate('click');
    expect(component.state().plugin.enabled).toBe(true);
    expect(btn.text()).toBe('Disable Plugin');
  });

  it('resets plugin', function() {
    let btn = component.find('button').at(1);
    btn.simulate('click');
    expect(component.state().plugin.config[0].value).toBe('default');
  });
});
