import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render} from 'sentry-test/reactTestingLibrary';

import ViewEditDashboard from 'sentry/views/dashboardsV2/view';

jest.mock('echarts-for-react/lib/core', () => {
  // We need to do this because `jest.mock` gets hoisted by babel and `React` is not
  // guaranteed to be in scope
  const ReactActual = require('react');

  // We need a class component here because `BaseChart` passes `ref` which will
  // error if we return a stateless/functional component
  return class extends ReactActual.Component {
    render() {
      // ReactEchartsCore accepts a style prop that determines height
      return <div style={{...this.props.style, background: 'green'}}>echarts mock</div>;
    }
  };
});

describe('Dashboards > Detail', function () {
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
    let initialData;

    beforeEach(function () {
      initialData = initializeOrg({organization});
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/visit/',
        method: 'POST',
        body: [],
        statusCode: 200,
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
        url: '/organizations/org-slug/events-stats/',
        body: TestStubs.EventsStats(),
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/users/',
        method: 'GET',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/',
        method: 'GET',
        body: [],
      });
    });

    afterEach(function () {
      MockApiClient.clearMockResponses();
      jest.clearAllMocks();
    });

    it('renders charts with the full height of the widget', async () => {
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
                layout: {x: 0, y: 0, w: 2, h: 6},
              }
            ),
            TestStubs.Widget(
              [{name: '', conditions: 'event.type:error', fields: ['count()']}],
              {
                title: 'Short Errors',
                interval: '1d',
                id: '2',
                layout: {x: 2, y: 0, w: 2, h: 2},
              }
            ),
          ],
          {id: '1', title: 'Custom Errors'}
        ),
      });
      const {container} = render(
        <ViewEditDashboard
          organization={initialData.organization}
          params={{orgId: 'org-slug', dashboardId: '1'}}
          router={initialData.router}
          location={initialData.router.location}
        />,
        {context: initialData.routerContext, organization: initialData.organization}
      );
      await act(async () => {
        await tick();
      });

      expect(container).toSnapshot();
    });
  });
});
