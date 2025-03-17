import {DashboardFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TagsFixture} from 'sentry-fixture/tags';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {
  DashboardWidgetSource,
  DisplayType,
  WidgetType,
} from 'sentry/views/dashboards/types';
import WidgetBuilder from 'sentry/views/dashboards/widgetBuilder';
import {VisualizationStep} from 'sentry/views/dashboards/widgetBuilder/buildSteps/visualizationStep';

import {DashboardsMEPProvider} from '../../widgetCard/dashboardsMEPContext';
import WidgetLegendSelectionState from '../../widgetLegendSelectionState';

jest.unmock('lodash/debounce');

function mockRequests(orgSlug: Organization['slug']) {
  const eventsMock = MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/events/`,
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
    body: TagsFixture(),
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

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/releases/',
    body: [],
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/recent-searches/',
    method: 'GET',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/spans/fields/`,
    body: [],
  });

  return {eventsMock};
}

describe('VisualizationStep', function () {
  const {organization, projects, router} = initializeOrg({
    organization: {
      features: ['performance-view', 'dashboards-edit', 'global-views', 'dashboards-mep'],
    },
    router: {
      location: {
        query: {
          source: DashboardWidgetSource.DASHBOARDS,
        },
      },
    },
  });

  const widgetLegendState = new WidgetLegendSelectionState({
    location: LocationFixture(),
    dashboard: DashboardFixture([], {id: 'new', title: 'Dashboard'}),
    organization,
    router,
  });

  beforeEach(function () {
    ProjectsStore.loadInitialData(projects);
  });

  it('debounce works as expected and requests are not triggered often', async function () {
    const {eventsMock} = mockRequests(organization.slug);

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
        widgetLegendState={widgetLegendState}
      />,
      {
        router,
        organization,
      }
    );

    await waitFor(() => expect(eventsMock).toHaveBeenCalledTimes(1));

    await userEvent.type(await screen.findByPlaceholderText('Alias'), 'abc', {
      delay: null,
    });

    await waitFor(() => expect(eventsMock).toHaveBeenCalledTimes(1));
  });

  it('displays stored data alert', async function () {
    mockRequests(organization.slug);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
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
        widgetLegendState={widgetLegendState}
      />,
      {
        router,
        organization: {
          ...organization,
          features: [...organization.features, 'dynamic-sampling', 'mep-rollout-flag'],
        },
      }
    );

    await screen.findByText(/we've automatically adjusted your results/i);
  });

  it('uses release from URL params when querying', async function () {
    const {eventsMock} = mockRequests(organization.slug);
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
        widgetLegendState={widgetLegendState}
      />,
      {
        router,
        organization,
      }
    );

    await waitFor(() =>
      expect(eventsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({query: ' release:"v1" '}),
        })
      )
    );
  });

  it('does not trigger an extra events request when adding a column', async function () {
    const {eventsMock} = mockRequests(organization.slug);
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
        widgetLegendState={widgetLegendState}
      />,
      {
        router,
        organization,
      }
    );

    await userEvent.click(screen.getByText('Add a Column'));

    // Only called once on the initial render
    await waitFor(() => expect(eventsMock).toHaveBeenCalledTimes(1));
  });

  it('makes a request to the spans dataset for a table widget', async function () {
    const {eventsMock} = mockRequests(organization.slug);
    const mockSpanWidget = {
      interval: '1d',
      title: 'Title',
      widgetType: WidgetType.SPANS,
      displayType: DisplayType.TABLE,
      queries: [
        {
          conditions: '',
          name: '',
          aggregates: ['count()'],
          columns: [],
          fields: [],
          orderby: '',
        },
      ],
    };

    render(
      <MEPSettingProvider>
        <DashboardsMEPProvider>
          <VisualizationStep
            pageFilters={PageFiltersFixture()}
            displayType={DisplayType.TABLE}
            error={undefined}
            onChange={jest.fn()}
            widget={mockSpanWidget}
            isWidgetInvalid={false}
            location={router.location}
            widgetLegendState={widgetLegendState}
          />
        </DashboardsMEPProvider>
      </MEPSettingProvider>,
      {organization}
    );

    await waitFor(() =>
      expect(eventsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'spans',
          }),
        })
      )
    );
  });
});
