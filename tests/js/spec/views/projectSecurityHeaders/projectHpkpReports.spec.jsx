import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectHpkpReports from 'app/views/settings/projectSecurityHeaders/hpkp';

describe('ProjectHpkpReports', function () {
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  const url = `/projects/${org.slug}/${project.slug}/hpkp/`;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [],
    });
  });

  it('renders', function () {
    const wrapper = mountWithTheme(
      <ProjectHpkpReports
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
