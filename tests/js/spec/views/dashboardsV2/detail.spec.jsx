import React from 'react';
import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import DashboardDetail from 'app/views/dashboardsV2/detail';

describe('Dashboards > Detail', function () {
  const organization = TestStubs.Organization({
    features: ['global-views', 'dashboards-v2', 'discover-query'],
    projects: [TestStubs.Project()],
  });

  describe('prebuilt dashboards', function () {
    let wrapper;
    let initialData;
    const route = {};

    beforeEach(function () {
      initialData = initializeOrg({organization});

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [TestStubs.Project()],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/',
        body: [
          {
            id: 'default-overview',
            title: 'Default',
            createdBy: '',
            dateCreated: '',
          },
          {
            id: '1',
            title: 'Custom Errors',
            createdBy: '',
            dateCreated: '',
          },
        ],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/default-overview/',
        body: {
          id: 'default-overview',
          title: 'Default',
          widgets: [],
          createdBy: '',
          dateCreated: '',
        },
      });
    });

    afterEach(function () {
      MockApiClient.clearMockResponses();
    });

    it('can delete', async function () {
      const deleteMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/default-overview/',
        method: 'DELETE',
      });
      wrapper = mountWithTheme(
        <DashboardDetail
          organization={initialData.organization}
          params={{orgId: 'org-slug', dashboardId: 'default-overview'}}
          router={initialData.router}
          route={route}
        />,
        initialData.routerContext
      );
      await tick();
      wrapper.update();

      // Enter edit mode.
      wrapper.find('Controls Button[data-test-id="dashboard-edit"]').simulate('click');

      // Click delete, request should be made.
      wrapper.find('Controls Button[data-test-id="dashboard-delete"]').simulate('click');
      expect(deleteMock).toHaveBeenCalled();
    });

    it('can rename and save', async function () {
      const updateMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/default-overview/',
        method: 'PUT',
        body: {
          id: 8,
          title: 'Updated prebuilt',
          widgets: [],
        },
      });
      wrapper = mountWithTheme(
        <DashboardDetail
          organization={initialData.organization}
          params={{orgId: 'org-slug', dashboardId: 'default-overview'}}
          router={initialData.router}
          location={initialData.router.location}
        />,
        initialData.routerContext
      );
      await tick();
      wrapper.update();

      // Enter edit mode.
      wrapper.find('Controls Button[data-test-id="dashboard-edit"]').simulate('click');

      // Rename
      wrapper.find('DashboardTitle Input').simulate('blur', {
        target: {innerText: 'Updated prebuilt', value: 'Updated prebuilt'},
      });

      wrapper.find('Controls Button[data-test-id="dashboard-commit"]').simulate('click');
      await tick();

      expect(updateMock).toHaveBeenCalledWith(
        '/organizations/org-slug/dashboards/default-overview/',
        expect.objectContaining({
          data: expect.objectContaining({title: 'Updated prebuilt'}),
        })
      );
      // Should redirect to the new dashboard.
      expect(browserHistory.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/dashboards/8/',
        })
      );
    });
  });

  describe('custom dashboards', function () {});
});
