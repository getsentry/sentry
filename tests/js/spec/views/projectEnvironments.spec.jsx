import {ThemeProvider} from 'emotion-theming';
import React from 'react';
import {mount} from 'enzyme';

import EnvironmentStore from 'app/stores/environmentStore';
import ProjectEnvironments from 'app/views/projectEnvironments';
import recreateRoute from 'app/utils/recreateRoute';
import theme from 'app/utils/theme';

jest.mock('app/utils/recreateRoute');

recreateRoute.mockReturnValue('/org-slug/project-slug/settings/');

function mountComponent(isHidden) {
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  let path = isHidden ? 'environments/hidden/' : 'environments/';
  return mount(
    <ThemeProvider theme={theme}>
      <ProjectEnvironments
        params={{
          orgId: org.slug,
          projectId: project.slug,
        }}
        route={{path}}
        routes={[]}
      />
    </ThemeProvider>,
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
      let errorMessage = wrapper.find('div').first();

      expect(errorMessage.text()).toContain("You don't have any environments yet");
      expect(wrapper.find('ProjectEnvironments')).toMatchSnapshot();
    });

    it('renders environment list', function() {
      EnvironmentStore.loadInitialData(TestStubs.Environments(false));
      const wrapper = mountComponent(false);

      // Production environment is default
      const productionRow = wrapper.find('PanelItem').first();
      const stagingRow = wrapper.find('PanelItem').last();

      expect(productionRow.find('Tag').prop('children')).toBe('Default');

      expect(productionRow.find('Button')).toHaveLength(1);

      expect(stagingRow.find('Tag')).toHaveLength(0);

      expect(
        stagingRow
          .find('Button')
          .first()
          .text()
      ).toBe('Set as default');
      expect(wrapper.find('ProjectEnvironments')).toMatchSnapshot();
    });
  });

  describe('render hidden', function() {
    it('renders empty message', function() {
      EnvironmentStore.loadHiddenData([]);

      const wrapper = mountComponent(true);
      let errorMessage = wrapper.find('div').first();

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
      wrapper
        .find('Button')
        .first()
        .simulate('click');
      expect(hideMock).toHaveBeenCalledWith(
        `${baseUrl}production/`,
        expect.objectContaining({
          data: expect.objectContaining({isHidden: true}),
        })
      );
    });

    it('shows', function() {
      EnvironmentStore.loadHiddenData(TestStubs.Environments(true));
      const wrapper = mountComponent(true);
      wrapper
        .find('Button')
        .first()
        .simulate('click');
      expect(showMock).toHaveBeenCalledWith(
        `${baseUrl}zzz/`,
        expect.objectContaining({
          data: expect.objectContaining({isHidden: false}),
        })
      );
    });
  });
});
