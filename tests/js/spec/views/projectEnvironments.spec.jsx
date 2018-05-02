import React from 'react';
import {mount} from 'enzyme';

import EnvironmentStore from 'app/stores/environmentStore';
import ProjectEnvironments from 'app/views/projectEnvironments';
import recreateRoute from 'app/utils/recreateRoute';
import {ALL_ENVIRONMENTS_KEY} from 'app/constants';

jest.mock('app/utils/recreateRoute');
recreateRoute.mockReturnValue('/org-slug/project-slug/settings/');

function mountComponent(isHidden) {
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  let path = isHidden ? 'environments/hidden/' : 'environments/';
  return mount(
    <ProjectEnvironments
      params={{
        orgId: org.slug,
        projectId: project.slug,
      }}
      route={{path}}
      routes={[]}
    />,
    TestStubs.routerContext()
  );
}

describe('ProjectEnvironments', function() {
  let project;
  let updateDefaultMock;

  beforeEach(function() {
    project = TestStubs.Project({
      defaultEnvironment: 'production',
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      body: project,
    });
    updateDefaultMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
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

    it('renders environment list and sets staging as default env', async function() {
      EnvironmentStore.loadInitialData(TestStubs.Environments(false));
      const wrapper = mountComponent(false);

      // Production environment is default
      const productionRow = wrapper.find('EnvironmentRow[name="production"]');
      const stagingRow = wrapper.find('EnvironmentRow[name="staging"]');

      expect(productionRow.find('Tag').prop('children')).toBe('Default');

      expect(productionRow.find('Button')).toHaveLength(1);

      expect(stagingRow.find('Tag')).toHaveLength(0);

      expect(
        stagingRow
          .find('Button')
          .first()
          .text()
      ).toBe('Set as default');

      // Can set as default
      stagingRow
        .find('Button')
        .first()
        .simulate('click');

      expect(updateDefaultMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            defaultEnvironment: 'staging',
          },
        })
      );

      expect(wrapper.find('EnvironmentRow[name="staging"] Tag')).toHaveLength(1);
      expect(wrapper.find('EnvironmentRow[name="production"] Tag')).toHaveLength(0);
      expect(wrapper.find('ProjectEnvironments')).toMatchSnapshot();
    });

    it('can set "(No Environment)" as default', function() {
      EnvironmentStore.loadInitialData([
        ...TestStubs.Environments(false),
        {
          id: 'no-environment-id',
          name: '',
          displayName: '(No Environment)',
        },
      ]);
      const wrapper = mountComponent(false);

      const noEnvironmentsRow = wrapper.find('EnvironmentRow[name=""]');

      // Not default
      expect(noEnvironmentsRow.find('Tag')).toHaveLength(0);

      // Is able to hide
      expect(noEnvironmentsRow.find('Button')).toHaveLength(2);
      expect(
        noEnvironmentsRow
          .find('Button')
          .first()
          .text()
      ).toBe('Set as default');
      noEnvironmentsRow
        .find('Button')
        .first()
        .simulate('click');

      expect(updateDefaultMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            defaultEnvironment: '',
          },
        })
      );

      // Is default
      expect(wrapper.find('EnvironmentRow[name=""]').find('Tag')).toHaveLength(1);
    });

    it('can set "All Environments" as default', function() {
      EnvironmentStore.loadInitialData(TestStubs.Environments(false));
      const wrapper = mountComponent(false);

      const allEnvironmentsRow = wrapper.find(
        `EnvironmentRow[name="${ALL_ENVIRONMENTS_KEY}"]`
      );

      // Not default
      expect(allEnvironmentsRow.find('Tag')).toHaveLength(0);

      // Should not have hide button
      expect(allEnvironmentsRow.find('Button')).toHaveLength(1);
      expect(allEnvironmentsRow.find('Button').text()).toBe('Set as default');

      // Set as default
      allEnvironmentsRow.find('Button').simulate('click');

      expect(updateDefaultMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            defaultEnvironment: null,
          },
        })
      );

      expect(
        wrapper.find(`EnvironmentRow[name="${ALL_ENVIRONMENTS_KEY}"]`).find('Tag')
      ).toHaveLength(1);
    });

    it('displays invalid environment in list with no actions', function() {
      project = TestStubs.Project({
        defaultEnvironment: 'invalid-environment',
      });
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        body: project,
      });
      EnvironmentStore.loadInitialData(TestStubs.Environments(false));
      const wrapper = mountComponent(false);

      const row = wrapper.find('EnvironmentRow[name="invalid-environment"]');

      // Is default
      expect(row.find('Tag')).toHaveLength(1);

      // Can not hide or set as default
      expect(row.find('Button')).toHaveLength(0);

      expect(wrapper.find('InvalidDefaultEnvironmentIcon')).toHaveLength(1);
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
      wrapper.find('EnvironmentRow[name="production"] Button').simulate('click');
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
