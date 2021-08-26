import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectUserFeedback from 'app/views/settings/project/projectUserFeedback';

describe('ProjectUserFeedback', function () {
  const org = TestStubs.Organization();
  const project = TestStubs.ProjectDetails();
  const url = `/projects/${org.slug}/${project.slug}/`;

  beforeEach(function () {
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

  it('can toggle sentry branding option', function () {
    const wrapper = mountWithTheme(
      <ProjectUserFeedback
        organization={org}
        project={project}
        params={{orgId: org.slug, projectId: project.slug}}
      />,
      TestStubs.routerContext()
    );

    const mock = MockApiClient.addMockResponse({
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
