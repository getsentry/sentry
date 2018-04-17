import React from 'react';

import $ from 'jquery';

import {mount} from 'enzyme';
import ProjectTags from 'app/views/projectTags';

describe('ProjectTags', function() {
  let org, project, wrapper;

  beforeEach(function() {
    org = TestStubs.Organization();
    project = TestStubs.Project();

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/tags/`,
      method: 'GET',
      body: TestStubs.Tags(),
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/tags/browser/`,
      method: 'DELETE',
    });

    wrapper = mount(
      <ProjectTags params={{orgId: org.slug, projectId: project.slug}} />,
      TestStubs.routerContext()
    );
  });

  it.skip('renders empty', function() {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/tags/`,
      method: 'GET',
      body: [],
    });

    wrapper = mount(
      <ProjectTags params={{orgId: org.slug, projectId: project.slug}} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('EmptyMessage')).toHaveLength(1);
  });

  it('renders', function() {
    expect(wrapper).toMatchSnapshot();
  });

  it('deletes tag', function() {
    let tags = wrapper.state('tags').length;

    wrapper
      .find('a.btn')
      .first()
      .simulate('click');

    // Press confirm in modal
    $(document.body)
      .find('.modal button:contains("Confirm")')
      .click();

    wrapper.update();

    expect(wrapper.state('tags')).toHaveLength(tags - 1);
  });
});
