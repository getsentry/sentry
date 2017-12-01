import React from 'react';
import {mount} from 'enzyme';

import ProjectTags from 'app/views/projectTags';

describe('ProjectTags', function() {
  let org, project, tags, wrapper;

  beforeEach(function() {
    org = TestStubs.Organization();
    project = TestStubs.Project();
    tags = TestStubs.Tags();

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/tags/`,
      method: 'GET',
      body: tags,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/tags/browser/`,
      method: 'DELETE',
    });

    wrapper = mount(<ProjectTags params={{orgId: org.slug, projectId: project.slug}} />, {
      context: {
        router: TestStubs.router(),
      },
    });
  });

  it('renders', function() {
    expect(wrapper).toMatchSnapshot();
  });

  it('deletes tag', function() {
    wrapper
      .find('tbody a.btn')
      .first()
      .simulate('click');
    expect(wrapper.find('tbody tr').length).toBe(1);
  });
});
