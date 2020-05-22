import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import ProjectSecurityHeaders from 'app/views/settings/projectSecurityHeaders';

describe('ProjectSecurityHeaders', function() {
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  const url = `/projects/${org.slug}/${project.slug}/`;

  beforeEach(function() {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [],
    });
  });

  it('renders', function() {
    const wrapper = shallow(
      <ProjectSecurityHeaders
        organization={org}
        project={project}
        {...TestStubs.routerProps({
          params: {orgId: org.slug, projectId: project.slug},
          location: TestStubs.location({pathname: url}),
        })}
      />,
      TestStubs.routerContext()
    );
    expect(wrapper).toMatchSnapshot();
  });
});
