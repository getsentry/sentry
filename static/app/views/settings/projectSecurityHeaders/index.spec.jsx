import {render} from 'sentry-test/reactTestingLibrary';

import ProjectSecurityHeaders from 'sentry/views/settings/projectSecurityHeaders';

describe('ProjectSecurityHeaders', function () {
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  const url = `/projects/${org.slug}/${project.slug}/`;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [],
    });
  });

  it('renders', function () {
    const wrapper = render(
      <ProjectSecurityHeaders
        organization={org}
        project={project}
        {...TestStubs.routerProps({
          params: {orgId: org.slug, projectId: project.slug},
          location: TestStubs.location({pathname: url}),
        })}
      />
    );
    expect(wrapper.container).toSnapshot();
  });
});
