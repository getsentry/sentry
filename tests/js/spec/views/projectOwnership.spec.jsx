import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import ProjectOwnership from 'app/views/settings/project/projectOwnership';

describe('ProjectTeamsSettings', function() {
  let org;
  let project;

  beforeEach(function() {
    org = TestStubs.Organization();
    project = TestStubs.ProjectDetails();

    Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });
    Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/ownership/`,
      method: 'GET',
      body: {
        raw: 'url:src @dummy@example.com',
        fallthrough: 'false',
        autoAssignment: 'false',
      },
    });
  });

  describe('render()', function() {
    it('renders', function() {
      const wrapper = mountWithTheme(
        <ProjectOwnership
          params={{orgId: org.slug, projectId: project.slug}}
          organization={org}
          project={project}
        />,
        TestStubs.routerContext()
      );
      expect(wrapper).toSnapshot();
    });
  });
});
