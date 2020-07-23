import React from 'react';
import $ from 'jquery';

import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectTags from 'app/views/settings/projectTags';

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

    wrapper = mountWithTheme(
      <ProjectTags params={{orgId: org.slug, projectId: project.slug}} />,
      TestStubs.routerContext()
    );
  });

  it('renders empty', function() {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/tags/`,
      method: 'GET',
      body: [],
    });

    wrapper = mountWithTheme(
      <ProjectTags params={{orgId: org.slug, projectId: project.slug}} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('EmptyMessage')).toHaveLength(1);
  });

  it('disables delete button for users without access', function() {
    const context = {
      organization: TestStubs.Organization({access: []}),
    };

    wrapper = mountWithTheme(
      <ProjectTags params={{orgId: org.slug, projectId: project.slug}} />,
      TestStubs.routerContext([context])
    );

    expect(wrapper.find('Button[disabled=false]')).toHaveLength(0);
  });

  it('renders', function() {
    expect(wrapper).toSnapshot();
    expect(wrapper).toMatchSnapshot();
  });

  it('deletes tag', function() {
    const tags = wrapper.state('tags').length;

    wrapper
      .find('Button')
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
