import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectExpectCtReports from 'app/views/settings/projectSecurityHeaders/expectCt';

describe('ProjectExpectCtReports', function () {
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  const url = `/projects/${org.slug}/${project.slug}/expect-ct/`;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [],
    });
  });

  it('renders', function () {
    const wrapper = mountWithTheme(
      <ProjectExpectCtReports
        organization={org}
        project={project}
        {...TestStubs.routerProps({
          params: {orgId: org.slug, projectId: project.slug},
          location: TestStubs.location({pathname: url}),
        })}
      />,
      TestStubs.routerContext()
    );
    expect(wrapper).toSnapshot();
  });
});
