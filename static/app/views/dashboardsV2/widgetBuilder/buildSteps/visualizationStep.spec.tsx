import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {Organization} from 'sentry/types';
import {DashboardWidgetSource} from 'sentry/views/dashboardsV2/types';
import WidgetBuilder from 'sentry/views/dashboardsV2/widgetBuilder';

jest.unmock('lodash/debounce');

function mockRequests(orgSlug: Organization['slug']) {
  const eventsv2Mock = MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/eventsv2/`,
    method: 'GET',
    statusCode: 200,
    body: {
      meta: {},
      data: [],
    },
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/tags/',
    method: 'GET',
    body: TestStubs.Tags(),
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/users/',
    body: [],
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/projects/',
    method: 'GET',
    body: [],
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/measurements-meta/',
    method: 'GET',
    body: {'measurements.custom.measurement': {functions: ['p99']}},
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/metrics-compatibility/',
    method: 'GET',
    body: {
      incompatible_projects: [],
      compatible_projects: [1],
    },
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/metrics-compatibility-sums/',
    method: 'GET',
    body: {
      sum: {
        metrics: 988803,
        metrics_null: 0,
        metrics_unparam: 132,
      },
    },
  });
  return {eventsv2Mock};
}

describe('VisualizationStep', function () {
  const {organization, router, routerContext} = initializeOrg({
    ...initializeOrg(),
    organization: {
      features: ['dashboards-edit', 'global-views', 'dashboards-mep'],
    },
    router: {
      location: {
        query: {
          source: DashboardWidgetSource.DASHBOARDS,
        },
      },
    },
  });

  it('debounce works as expected and requests are not triggered often', async function () {
    const {eventsv2Mock} = mockRequests(organization.slug);

    jest.useFakeTimers();

    render(
      <WidgetBuilder
        route={{}}
        router={router}
        routes={router.routes}
        routeParams={router.params}
        location={router.location}
        dashboard={{
          id: 'new',
          title: 'Dashboard',
          createdBy: undefined,
          dateCreated: '2020-01-01T00:00:00.000Z',
          widgets: [],
          projects: [],
          filters: {},
        }}
        onSave={jest.fn()}
        params={{
          orgId: organization.slug,
          dashboardId: 'new',
        }}
      />,
      {
        context: routerContext,
        organization,
      }
    );

    await waitFor(() => expect(eventsv2Mock).toHaveBeenCalledTimes(1));

    userEvent.type(await screen.findByPlaceholderText('Alias'), 'abc');
    act(() => {
      jest.advanceTimersByTime(DEFAULT_DEBOUNCE_DURATION + 1);
    });

    await waitFor(() => expect(eventsv2Mock).toHaveBeenCalledTimes(2));
  });

  it('displays stored data alert', async function () {
    mockRequests(organization.slug);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/eventsv2/`,
      method: 'GET',
      statusCode: 200,
      body: {
        meta: {isMetricsData: false},
        data: [],
      },
    });

    render(
      <WidgetBuilder
        route={{}}
        router={router}
        routes={router.routes}
        routeParams={router.params}
        location={router.location}
        dashboard={{
          id: 'new',
          title: 'Dashboard',
          createdBy: undefined,
          dateCreated: '2020-01-01T00:00:00.000Z',
          widgets: [],
          projects: [],
          filters: {},
        }}
        onSave={jest.fn()}
        params={{
          orgId: organization.slug,
          dashboardId: 'new',
        }}
      />,
      {
        context: routerContext,
        organization: {
          ...organization,
          features: [
            ...organization.features,
            'server-side-sampling',
            'mep-rollout-flag',
          ],
        },
      }
    );

    await screen.findByText(/we've automatically adjusted your results/i);
  });

  it('uses release from URL params when querying', async function () {
    const {eventsv2Mock} = mockRequests(organization.slug);
    render(
      <WidgetBuilder
        route={{}}
        router={router}
        routes={router.routes}
        routeParams={router.params}
        location={{
          ...router.location,
          query: {
            ...router.location.query,
            release: ['v1'],
          },
        }}
        dashboard={{
          id: 'new',
          title: 'Dashboard',
          createdBy: undefined,
          dateCreated: '2020-01-01T00:00:00.000Z',
          widgets: [],
          projects: [],
          filters: {},
        }}
        onSave={jest.fn()}
        params={{
          orgId: organization.slug,
          dashboardId: 'new',
        }}
      />,
      {
        context: routerContext,
        organization,
      }
    );

    await waitFor(() =>
      expect(eventsv2Mock).toHaveBeenCalledWith(
        '/organizations/org-slug/eventsv2/',
        expect.objectContaining({
          query: expect.objectContaining({query: ' release:v1 '}),
        })
      )
    );
  });
});
