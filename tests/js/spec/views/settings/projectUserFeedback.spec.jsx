import React from 'react';

import {mount} from 'enzyme';
import ProjectUserFeedback from 'app/views/settings/project/projectUserFeedback';

describe('ProjectUserFeedback', function() {
  let org = TestStubs.Organization();
  let project = TestStubs.ProjectDetails();
  let url = `/projects/${org.slug}/${project.slug}/`;

  beforeEach(function() {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: TestStubs.Project(),
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [],
    });
  });

  it('can toggle sentry branding option', function() {
    let wrapper = mount(
      <ProjectUserFeedback
        organization={org}
        project={project}
        setProjectNavSection={() => {}}
        params={{orgId: org.slug, projectId: project.slug}}
      />,
      TestStubs.routerContext()
    );

    let mock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
    });

    expect(mock).not.toHaveBeenCalled();

    // Click Regenerate Token
    wrapper.find('Switch').simulate('click');

    expect(mock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'PUT',
        data: {
          options: {'feedback:branding': true},
        },
      })
    );
  });
});
