import React from 'react';
import {mount} from 'enzyme';

import EnvironmentStore from 'app/stores/environmentStore';
import ProjectEnvironments from 'app/views/projectEnvironments';
import recreateRoute from 'app/utils/recreateRoute';
import {ALL_ENVIRONMENTS_KEY} from 'app/constants';

jest.mock('app/utils/recreateRoute');
recreateRoute.mockReturnValue('/org-slug/project-slug/settings/environments/');

function mountComponent(isHidden) {
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  const pathname = isHidden ? 'environments/hidden/' : 'environments/';
  return mount(
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

describe('ProjectEnvironments', function() {
  let project;

  beforeEach(function() {
    project = TestStubs.Project({
      defaultEnvironment: 'production',
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      body: project,
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  describe('render active', function() {
    it('renders empty message', function() {
      EnvironmentStore.loadInitialData([]);
      const wrapper = mountComponent(false);
      const errorMessage = wrapper.find('div').first();

      expect(errorMessage.text()).toContain("You don't have any environments yet");
      expect(wrapper.find('ProjectEnvironments')).toMatchSnapshot();
    });

    it('renders environment list', async function() {
      EnvironmentStore.loadInitialData(TestStubs.Environments(false));
      const wrapper = mountComponent(false);

      const productionRow = wrapper.find('EnvironmentRow[name="production"]');

      expect(productionRow.find('Button')).toHaveLength(1);
    });
  });

  describe('render hidden', function() {
    it('renders empty message', function() {
      EnvironmentStore.loadHiddenData([]);

      const wrapper = mountComponent(true);
      const errorMessage = wrapper.find('div').first();

      expect(errorMessage.text()).toContain("You don't have any hidden environments");

      expect(wrapper.find('ProjectEnvironments')).toMatchSnapshot();
    });

    it('renders environment list', function() {
      EnvironmentStore.loadHiddenData(TestStubs.Environments(true));
      const wrapper = mountComponent(true);

      // Hidden buttons should not have "Set as default"
      expect(wrapper.find('Button').text()).toBe('Show');
      expect(wrapper.find('ProjectEnvironments')).toMatchSnapshot();
    });
  });

  describe('toggle', function() {
    let hideMock, showMock;
    const baseUrl = '/projects/org-slug/project-slug/environments/';
    beforeEach(function() {
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
    it('hides', function() {
      EnvironmentStore.loadInitialData(TestStubs.Environments(false));
      const wrapper = mountComponent(false);
      wrapper.find('EnvironmentRow[name="production"] Button').simulate('click');
      expect(hideMock).toHaveBeenCalledWith(
        `${baseUrl}production/`,
        expect.objectContaining({
          data: expect.objectContaining({isHidden: true}),
        })
      );
    });

    it('hides names requiring encoding', function() {
      hideMock = MockApiClient.addMockResponse({
        url: `${baseUrl}%25app_env%25/`,
        method: 'PUT',
      });

      const environments = [{id: '1', name: '%app_env%', isHidden: false}];
      EnvironmentStore.loadInitialData(environments);

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

    it('shows', function() {
      EnvironmentStore.loadHiddenData(TestStubs.Environments(true));
      const wrapper = mountComponent(true);
      wrapper.find('EnvironmentRow[name="zzz"] Button').simulate('click');
      expect(showMock).toHaveBeenCalledWith(
        `${baseUrl}zzz/`,
        expect.objectContaining({
          data: expect.objectContaining({isHidden: false}),
        })
      );
    });

    it('does not have "All Enviroments" rows', function() {
      EnvironmentStore.loadHiddenData(TestStubs.Environments(true));
      const wrapper = mountComponent(true);
      expect(wrapper.find(`EnvironmentRow[name="${ALL_ENVIRONMENTS_KEY}"]`)).toHaveLength(
        0
      );
    });
  });
});
