import React from 'react';
import {mount} from 'enzyme';
import ProjectPlugins from 'app/views/projectPlugins';

describe('ProjectPlugins', function() {
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
      }
    );
  });
  it('renders', function() {
    expect(wrapper).toMatchSnapshot();
  });

  it('enables plugin', function() {
    let checkbox = wrapper.find('input[name="amazon-sqs"]');

    checkbox.simulate('change', {target: {checked: true}});

    expect(checkbox.props().checked).toBe(true);
  });

  it('disables plugin', function() {
    let checkbox = wrapper.find('input[name="github"]');

    checkbox.simulate('change', {target: {checked: false}});

    expect(checkbox.props().checked).toBe(false);
  });
});
