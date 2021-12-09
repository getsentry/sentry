import {enforceActOnUseLegacyStoreHook, mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import * as modals from 'sentry/actionCreators/modal';
import ViewEditDashboard from 'sentry/views/dashboardsV2/view';

describe('Dashboards > Detail', function () {
  enforceActOnUseLegacyStoreHook();

  const organization = TestStubs.Organization({
    features: ['global-views', 'dashboards-basic', 'dashboards-edit', 'discover-query'],
  });

  describe('custom dashboards', function () {
    let wrapper, initialData, widgets;

    beforeEach(function () {
      initialData = initializeOrg({organization});
      widgets = [
        TestStubs.Widget(
          [{name: '', conditions: 'event.type:error', fields: ['count()']}],
          {
            title: 'Errors',
            interval: '1d',
            id: '1',
          }
        ),
        TestStubs.Widget(
          [{name: '', conditions: 'event.type:transaction', fields: ['count()']}],
          {
            title: 'Transactions',
            interval: '1d',
            id: '2',
          }
        ),
        TestStubs.Widget(
          [
            {
              name: '',
              conditions: 'event.type:transaction transaction:/api/cats',
              fields: ['p50()'],
            },
          ],
          {
            title: 'p50 of /api/cats',
            interval: '1d',
            id: '3',
          }
        ),
      ];
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/visit/',
        method: 'POST',
        body: [],
        statusCode: 200,
      });
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
          TestStubs.Dashboard([], {
            id: 'default-overview',
            title: 'Default',
            widgetDisplay: ['area'],
          }),
          TestStubs.Dashboard([], {
            id: '1',
            title: 'Custom Errors',
            widgetDisplay: ['area'],
          }),
        ],
      });
      MockApiClient.addMockResponse({
        method: 'GET',
        url: '/organizations/org-slug/dashboards/1/',
        body: TestStubs.Dashboard(widgets, {id: '1', title: 'Custom Errors'}),
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        method: 'PUT',
        body: TestStubs.Dashboard(widgets, {id: '1', title: 'Custom Errors'}),
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: {data: []},
      });
      MockApiClient.addMockResponse({
        method: 'POST',
        url: '/organizations/org-slug/dashboards/widgets/',
        body: [],
      });
      MockApiClient.addMockResponse({
        method: 'GET',
        url: '/organizations/org-slug/recent-searches/',
        body: [],
      });
      MockApiClient.addMockResponse({
        method: 'GET',
        url: '/organizations/org-slug/issues/',
        body: [],
      });
    });

    afterEach(function () {
      MockApiClient.clearMockResponses();
      if (wrapper) {
        wrapper.unmount();
      }
    });

    it('opens edit modal for widgets', async function () {
      const openEditModal = jest.spyOn(modals, 'openAddDashboardWidgetModal');

      wrapper = mountWithTheme(
        <ViewEditDashboard
          organization={initialData.organization}
          params={{orgId: 'org-slug', dashboardId: '1'}}
          router={initialData.router}
          location={initialData.router.location}
        />,
        initialData.routerContext
      );
      await tick();
      wrapper.update();

      // Enter edit mode.
      wrapper.find('Controls Button[data-test-id="dashboard-edit"]').simulate('click');
      wrapper.update();

      const card = wrapper.find('WidgetCard').first();
      card.find('StyledPanel').simulate('mouseOver');

      // Edit the first widget
      wrapper
        .find('WidgetCard')
        .first()
        .find('IconClick[data-test-id="widget-edit"]')
        .simulate('click');

      expect(openEditModal).toHaveBeenCalledTimes(1);
      expect(openEditModal).toHaveBeenCalledWith(
        expect.objectContaining({
          widget: {
            id: '1',
            interval: '1d',
            queries: [
              {
                conditions: 'event.type:error',
                fields: ['count()'],
                name: '',
              },
            ],
            title: 'Errors',
            type: 'line',
          },
        })
      );
    });
  });
});
