import {enforceActOnUseLegacyStoreHook, mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import * as utils from 'sentry/views/dashboardsV2/gridLayout/utils';
import ViewEditDashboard from 'sentry/views/dashboardsV2/view';

describe('Dashboards > Detail', function () {
  enforceActOnUseLegacyStoreHook();

  const organization = TestStubs.Organization({
    features: [
      'global-views',
      'dashboards-basic',
      'dashboards-edit',
      'discover-query',
      'dashboard-grid-layout',
    ],
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
        body: TestStubs.EventsStats(),
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
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/eventsv2/',
        method: 'GET',
        body: [],
      });
    });

    afterEach(function () {
      MockApiClient.clearMockResponses();
      jest.clearAllMocks();
      if (wrapper) {
        wrapper.unmount();
      }
    });

    // it('renders charts with the full height of the widget', async () => {
    //   jest.spyOn(utils, 'getDashboardLayout').mockReturnValueOnce([
    //     {i: 'grid-item-1', x: 0, y: 0, w: 2, h: 6},
    //     {i: 'grid-item-2', x: 2, y: 0, w: 2, h: 2},
    //   ]);

    //   MockApiClient.addMockResponse({
    //     url: '/organizations/org-slug/dashboards/1/',
    //     body: TestStubs.Dashboard(
    //       [
    //         TestStubs.Widget(
    //           [{name: '', conditions: 'event.type:error', fields: ['count()']}],
    //           {
    //             title: 'Tall Errors',
    //             interval: '1d',
    //             id: '1',
    //           }
    //         ),
    //         TestStubs.Widget(
    //           [{name: '', conditions: 'event.type:error', fields: ['count()']}],
    //           {
    //             title: 'Short Errors',
    //             interval: '1d',
    //             id: '2',
    //           }
    //         ),
    //       ],
    //       {id: '1', title: 'Custom Errors'}
    //     ),
    //   });
    //   wrapper = mountWithTheme(
    //     <ViewEditDashboard
    //       organization={initialData.organization}
    //       params={{orgId: 'org-slug', dashboardId: '1'}}
    //       router={initialData.router}
    //       location={initialData.router.location}
    //     />,
    //     initialData.routerContext
    //   );
    //   await tick();
    //   wrapper.update();

    //   expect(wrapper).toSnapshot();
    // });

    it('renders charts with the full height of the widget', async () => {
      jest.spyOn(utils, 'getDashboardLayout').mockReturnValueOnce([
        {i: 'grid-item-1', x: 0, y: 0, w: 2, h: 6},
        {i: 'grid-item-2', x: 2, y: 0, w: 2, h: 2},
      ]);
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: TestStubs.Dashboard(
          [
            TestStubs.Widget(
              [{name: '', conditions: 'event.type:error', fields: ['count()']}],
              {
                title: 'Tall Errors',
                interval: '1d',
                id: '1',
              }
            ),
            TestStubs.Widget(
              [{name: '', conditions: 'event.type:error', fields: ['count()']}],
              {
                title: 'Short Errors',
                interval: '1d',
                id: '2',
              }
            ),
          ],
          {id: '1', title: 'Custom Errors'}
        ),
      });
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

      expect(wrapper).toSnapshot();
    });
  });
});
