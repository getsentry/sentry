import {mountWithTheme} from 'sentry-test/enzyme';

import {openModal} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import ProjectOwnership from 'app/views/settings/project/projectOwnership';

jest.mock('app/actionCreators/modal');

describe('Project Ownership', function () {
  let org = TestStubs.Organization();
  const project = TestStubs.ProjectDetails();

  beforeEach(function () {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/ownership/`,
      method: 'GET',
      body: {
        fallthrough: false,
        autoAssignment: false,
      },
    });
    Client.addMockResponse({
      url: `/organizations/${org.slug}/code-mappings/`,
      query: {projectId: project.id},
      method: 'GET',
      body: [],
    });
    Client.addMockResponse({
      url: `/organizations/${org.slug}/integrations/`,
      query: {features: 'codeowners'},
      method: 'GET',
      body: [TestStubs.GithubIntegrationConfig()],
    });
    Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/codeowners/`,
      features: {expand: 'codeMapping'},
      method: 'GET',
      body: [],
    });
  });

  describe('without codeowners', function () {
    it('renders', function () {
      const wrapper = mountWithTheme(
        <ProjectOwnership
          params={{orgId: org.slug, projectId: project.slug}}
          organization={org}
          project={project}
        />,
        TestStubs.routerContext()
      );
      expect(wrapper).toSnapshot();
      // only rendered when `integrations-codeowners` feature flag enabled
      expect(wrapper.find('CodeOwnerButton').exists()).toBe(false);
    });
  });

  describe('codeowner action button', function () {
    it('renders button', function () {
      org = TestStubs.Organization({features: ['integrations-codeowners']});

      const wrapper = mountWithTheme(
        <ProjectOwnership
          params={{orgId: org.slug, projectId: project.slug}}
          organization={org}
          project={project}
        />,
        TestStubs.routerContext([{organization: org}])
      );

      expect(wrapper.find('CodeOwnerButton').exists()).toBe(true);
    });
    it('clicking button opens modal', async function () {
      const wrapper = mountWithTheme(
        <ProjectOwnership
          params={{orgId: org.slug, projectId: project.slug}}
          organization={org}
          project={project}
        />,
        TestStubs.routerContext([{organization: org}])
      );
      wrapper.find('[data-test-id="add-codeowner-button"] button').simulate('click');
      expect(openModal).toHaveBeenCalled();
    });
  });
});
