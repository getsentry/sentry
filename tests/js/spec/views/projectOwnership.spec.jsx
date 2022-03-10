import {mountWithTheme} from 'sentry-test/enzyme';

import {openModal} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import ProjectOwnership from 'sentry/views/settings/project/projectOwnership';

jest.mock('sentry/actionCreators/modal');

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
      query: {project: project.id},
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
        />
      );
      expect(wrapper).toSnapshot();
      // only rendered when `integrations-codeowners` feature flag enabled
      expect(wrapper.find('CodeOwnerButton').exists()).toBe(false);
    });
  });

  describe('codeowner action button', function () {
    it('renders button', function () {
      org = TestStubs.Organization({
        features: ['integrations-codeowners'],
        access: ['org:integrations'],
      });

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
      org = TestStubs.Organization({
        features: ['integrations-codeowners'],
        access: ['org:integrations'],
      });
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

    it('render request to add if no permissions', function () {
      org = TestStubs.Organization({features: ['integrations-codeowners'], access: []});

      const wrapper = mountWithTheme(
        <ProjectOwnership
          params={{orgId: org.slug, projectId: project.slug}}
          organization={org}
          project={project}
        />,
        TestStubs.routerContext([{organization: org}])
      );
      expect(
        wrapper.find('[data-test-id="add-codeowner-request-button"] button').exists()
      ).toBe(true);
    });
  });
});
