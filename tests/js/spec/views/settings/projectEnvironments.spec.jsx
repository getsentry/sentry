import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectEnvironments from 'app/views/settings/project/projectEnvironments';
import recreateRoute from 'app/utils/recreateRoute';
import {ALL_ENVIRONMENTS_KEY} from 'app/constants';

jest.mock('app/utils/recreateRoute');
recreateRoute.mockReturnValue('/org-slug/project-slug/settings/environments/');

function mountComponent(isHidden) {
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  const pathname = isHidden ? 'environments/hidden/' : 'environments/';
  return mountWithTheme(
    <ProjectEnvironments
      params={{
        orgId: org.slug,
        projectId: project.slug,
      }}
      location={{pathname}}
      routes={[]}
    />,
    TestStubs.routerContext()
  );
}

describe('ProjectEnvironments', function () {
  let project;

  beforeEach(function () {
    project = TestStubs.Project({
      defaultEnvironment: 'production',
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      body: project,
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('render active', function () {
    it('renders empty message', function () {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/environments/',
        body: [],
      });

      const wrapper = mountComponent(false);
      const errorMessage = wrapper.find('div').first();

      expect(errorMessage.text()).toContain("You don't have any environments yet");
      expect(wrapper.find('ProjectEnvironments')).toSnapshot();
    });

    it('renders environment list', async function () {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/environments/',
        body: TestStubs.Environments(false),
      });
      const wrapper = mountComponent(false);

      const productionRow = wrapper.find('EnvironmentRow[name="production"]');

      expect(productionRow.find('Button')).toHaveLength(1);
    });
  });

  describe('render hidden', function () {
    it('renders empty message', function () {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/environments/',
        body: [],
      });

      const wrapper = mountComponent(true);
      const errorMessage = wrapper.find('div').first();

      expect(errorMessage.text()).toContain("You don't have any hidden environments");

      expect(wrapper.find('ProjectEnvironments')).toSnapshot();
    });

    it('renders environment list', function () {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/environments/',
        body: TestStubs.Environments(true),
      });
      const wrapper = mountComponent(true);

      // Hidden buttons should not have "Set as default"
      expect(wrapper.find('Button').text()).toBe('Show');
      expect(wrapper.find('ProjectEnvironments')).toSnapshot();
    });
  });

  describe('toggle', function () {
    let hideMock, showMock;
    const baseUrl = '/projects/org-slug/project-slug/environments/';
    beforeEach(function () {
      hideMock = MockApiClient.addMockResponse({
        url: `${baseUrl}production/`,
        method: 'PUT',
      });
      showMock = MockApiClient.addMockResponse({
        url: `${baseUrl}zzz/`,
        method: 'PUT',
      });

      MockApiClient.addMockResponse({
        url: baseUrl,
      });
    });
    it('hides', function () {
      MockApiClient.addMockResponse({
        url: baseUrl,
        body: TestStubs.Environments(false),
      });

      const wrapper = mountComponent(false);
      wrapper.find('EnvironmentRow[name="production"] Button').simulate('click');
      expect(hideMock).toHaveBeenCalledWith(
        `${baseUrl}production/`,
        expect.objectContaining({
          data: expect.objectContaining({isHidden: true}),
        })
      );
    });

    it('hides names requiring encoding', function () {
      MockApiClient.addMockResponse({
        url: baseUrl,
        body: [{id: '1', name: '%app_env%', isHidden: false}],
      });

      hideMock = MockApiClient.addMockResponse({
        url: `${baseUrl}%25app_env%25/`,
        method: 'PUT',
      });

      const wrapper = mountComponent(false);

      wrapper
        .find('EnvironmentRow[name="%app_env%"] button[aria-label="Hide"]')
        .simulate('click');
      expect(hideMock).toHaveBeenCalledWith(
        `${baseUrl}%25app_env%25/`,
        expect.objectContaining({
          data: expect.objectContaining({isHidden: true}),
        })
      );
    });

    it('shows', function () {
      MockApiClient.addMockResponse({
        url: baseUrl,
        body: TestStubs.Environments(true),
      });

      const wrapper = mountComponent(true);
      wrapper.find('EnvironmentRow[name="zzz"] Button').simulate('click');
      expect(showMock).toHaveBeenCalledWith(
        `${baseUrl}zzz/`,
        expect.objectContaining({
          data: expect.objectContaining({isHidden: false}),
        })
      );
    });

    it('does not have "All Environments" rows', function () {
      MockApiClient.addMockResponse({
        url: baseUrl,
        body: TestStubs.Environments(true),
      });

      const wrapper = mountComponent(true);
      expect(wrapper.find(`EnvironmentRow[name="${ALL_ENVIRONMENTS_KEY}"]`)).toHaveLength(
        0
      );
    });
  });
});
