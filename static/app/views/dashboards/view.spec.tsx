import {Fragment} from 'react';
import {DashboardFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {WidgetFixture} from 'sentry-fixture/widget';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {browserHistory} from 'sentry/utils/browserHistory';
import usePageFilters from 'sentry/utils/usePageFilters';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import ViewEditDashboard from 'sentry/views/dashboards/view';

jest.mock('sentry/utils/usePageFilters');

describe('Dashboards > ViewEditDashboard', function () {
  let initialData = initializeOrg({
    organization: {
      features: ['dashboards-basic', 'dashboards-edit'],
    },
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();

    MockApiClient.addMockResponse({
      url: `/organizations/${initialData.organization.slug}/dashboards/1/visit/`,
      statusCode: 200,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${initialData.organization.slug}/dashboards/`,
      statusCode: 200,
      body: [DashboardFixture([])],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${initialData.organization.slug}/dashboards/widgets/`,
      statusCode: 200,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${initialData.organization.slug}/dashboards/1/`,
      statusCode: 200,
      body: DashboardFixture([]),
    });

    jest.mocked(usePageFilters).mockReturnValue({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: {
        datetime: {
          period: '10d',
          start: null,
          end: null,
          utc: false,
        },
        environments: [],
        projects: [],
      },
    });
  });

  it('removes widget params from url and preserves selection params', async function () {
    const location = {
      pathname: '/',
      query: {
        environment: 'canary',
        period: '7d',
        project: '11111',
        start: null,
        end: null,
        utc: null,
        displayType: 'line',
        interval: '5m',
        queryConditions: '',
        queryFields: 'count()',
        queryNames: '',
        queryOrderby: '',
        title: 'test',
        statsPeriod: '7d',
      },
    };

    render(
      <ViewEditDashboard
        location={LocationFixture(location)}
        organization={initialData.organization}
        router={initialData.router}
        params={{
          orgId: initialData.organization.slug,
          dashboardId: '1',
        }}
        route={{}}
        routes={[]}
        routeParams={{}}
      >
        <Fragment />
      </ViewEditDashboard>
    );

    expect(await screen.findByRole('heading', {name: 'Dashboard'})).toBeInTheDocument();

    expect(browserHistory.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/',
        query: {
          end: null,
          environment: 'canary',
          period: '7d',
          project: '11111',
          start: null,
          statsPeriod: '7d',
          utc: null,
        },
      })
    );
  });

  it('updates the table widget with the discover split decision', async function () {
    initialData = initializeOrg({
      organization: {
        features: [
          'dashboards-basic',
          'dashboards-edit',
          'performance-discover-dataset-selector',
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${initialData.organization.slug}/dashboards/`,
      statusCode: 200,
      body: [DashboardFixture([], {id: '1', title: 'Custom Errors'})],
    });

    const widgets = [
      WidgetFixture({
        widgetType: WidgetType.DISCOVER,
        id: '1',
        title: 'Split to Errors Widget',
        displayType: DisplayType.TABLE,
      }),
    ];
    MockApiClient.addMockResponse({
      url: `/organizations/${initialData.organization.slug}/dashboards/1/`,
      statusCode: 200,
      body: DashboardFixture(widgets, {
        id: '1',
        title: 'Custom Errors',
        filters: {},
      }),
    });
    const eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${initialData.organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [],
        meta: {discoverWidgetSplit: 'error-events'},
      },
    });

    // Clear the query so we don't go into the edit state
    const location = LocationFixture();
    location.query = {};

    // render the dashboard with it set up with a discover widget
    render(
      <ViewEditDashboard
        location={location}
        organization={initialData.organization}
        router={initialData.router}
        params={{
          orgId: initialData.organization.slug,
          dashboardId: '1',
        }}
        route={{}}
        routes={[]}
        routeParams={{}}
      >
        <Fragment />
      </ViewEditDashboard>
    );

    await waitFor(() => {
      expect(eventsMock).toHaveBeenCalledTimes(1);
    });

    // Check the state of the widget
    // await userEvent.click(screen.getByRole('button', {name: 'Edit Dashboard'}));
    // expect(await screen.findByText('Save and Finish')).toBeInTheDocument();
    // await userEvent.click(screen.getByRole('button', {name: /duplicate widget/}));
  });
});
