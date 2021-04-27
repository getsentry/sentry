import {mountWithTheme} from 'sentry-test/enzyme';

import {openModal} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import ProjectOwnership from 'app/views/settings/project/projectOwnership';

jest.mock('app/actionCreators/modal');

describe('Project Ownership', function () {
  let org;
  let project;

  beforeEach(function () {
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
    Client.addMockResponse({
      url: `/organizations/${org.slug}/code-mappings/?projectId=${project.id}`,
      method: 'GET',
      body: [],
    });
  });

  describe('render()', function () {
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
      // only rendered when `import-codeowners` feature flag enabled
      expect(wrapper.find('CodeOwnerButton').exists()).toBe(false);
    });
  });
});

describe('Add Codeowner File', function () {
  const org = TestStubs.Organization({features: ['import-codeowners']});
  const project = TestStubs.ProjectDetails();

  beforeEach(function () {
    Client.clearMockResponses();
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
    Client.addMockResponse({
      url: `/organizations/${org.slug}/code-mappings/?projectId=${project.id}`,
      method: 'GET',
      body: [],
    });
    Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/codeowners/?expand=codeMapping`,
      method: 'GET',
      body: [],
    });
    Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      method: 'GET',
      body: [],
    });
  });

  describe('codeowner action button', function () {
    it('renders button', function () {
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
