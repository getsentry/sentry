import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {WidgetFixture} from 'sentry-fixture/widget';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import CreateDashboard from 'sentry/views/dashboards/create';
import {DisplayType} from 'sentry/views/dashboards/types';

describe('Dashboards > CreateDashboard', () => {
  const organization = OrganizationFixture({
    features: ['dashboards-basic', 'dashboards-edit', 'discover-query'],
  });

  let mockPOST: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([ProjectFixture()]);
    PageFiltersStore.reset();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/measurements-meta/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });

    mockPOST = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      method: 'POST',
      body: [],
    });
  });

  it('renders create dashboard without widgets', async () => {
    render(<CreateDashboard />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/dashboards/new/',
        },
      },
    });

    // Should render the dashboard in create mode
    expect(screen.getByText('Create Dashboard')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', {name: 'Save and Finish'})
    ).toBeInTheDocument();
  });

  it('auto-adds widgets from location.state.widgets to dashboard', async () => {
    const widget1 = WidgetFixture({
      id: '1',
      title: 'Test Widget 1',
      displayType: DisplayType.LINE,
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['count()'],
          aggregates: ['count()'],
          columns: [],
          orderby: '',
        },
      ],
    });

    const widget2 = WidgetFixture({
      id: '2',
      title: 'Test Widget 2',
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: '',
          conditions: 'event.type:error',
          fields: ['title', 'count()'],
          aggregates: ['count()'],
          columns: ['title'],
          orderby: '-count()',
        },
      ],
    });

    const {router} = render(<CreateDashboard />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/dashboards/new/',
          state: {widgets: [widget1, widget2]},
        },
      },
    });

    // Wait for widgets to be rendered
    expect(await screen.findAllByTestId('sortable-widget')).toHaveLength(2);

    // Verify location state is cleared after consuming widgets
    await waitFor(() => {
      expect(router.location.state).toEqual({});
    });
    expect(router.location.pathname).toBe('/organizations/org-slug/dashboards/new/');

    // Click save to check that the widgets are passed to the API
    await userEvent.click(await screen.findByRole('button', {name: 'Save and Finish'}));
    expect(mockPOST).toHaveBeenCalledWith(
      '/organizations/org-slug/dashboards/',
      expect.objectContaining({
        data: expect.objectContaining({
          widgets: [expect.objectContaining(widget1), expect.objectContaining(widget2)],
        }),
      })
    );
  });

  it('handles single widget from location.state', async () => {
    const widget = WidgetFixture({
      title: 'Error Count Widget',
      displayType: DisplayType.BIG_NUMBER,
      queries: [
        {
          name: '',
          conditions: 'event.type:error',
          fields: ['count()'],
          aggregates: ['count()'],
          columns: [],
          orderby: '',
        },
      ],
    });

    render(<CreateDashboard />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/dashboards/new/',
          state: {widgets: [widget]},
        },
      },
    });

    // Widget should be rendered in the dashboard
    expect(await screen.findByTestId('sortable-widget')).toBeInTheDocument();

    // Click save to check that the widgets are passed to the API
    await userEvent.click(await screen.findByRole('button', {name: 'Save and Finish'}));
    expect(mockPOST).toHaveBeenCalledWith(
      '/organizations/org-slug/dashboards/',
      expect.objectContaining({
        data: expect.objectContaining({
          widgets: [expect.objectContaining(widget)],
        }),
      })
    );
  });

  it('handles empty widgets array in location.state', async () => {
    render(<CreateDashboard />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/dashboards/new/',
          state: {widgets: []},
        },
      },
    });

    // Should render like a normal create dashboard without widgets
    expect(await screen.findByText('Create Dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('sortable-widget')).not.toBeInTheDocument();
  });

  it('preserves widget properties when auto-adding from location.state', async () => {
    const complexWidget = WidgetFixture({
      title: 'Complex Widget',
      displayType: DisplayType.AREA,
      interval: '5m',
      queries: [
        {
          name: 'Query 1',
          conditions: 'transaction.duration:>100',
          fields: ['transaction', 'p95(transaction.duration)', 'count()'],
          aggregates: ['p95(transaction.duration)', 'count()'],
          columns: ['transaction'],
          orderby: '-p95(transaction.duration)',
        },
        {
          name: 'Query 2',
          conditions: 'transaction.duration:<50',
          fields: ['transaction', 'p50(transaction.duration)'],
          aggregates: ['p50(transaction.duration)'],
          columns: ['transaction'],
          orderby: '-p50(transaction.duration)',
        },
      ],
    });

    render(<CreateDashboard />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/dashboards/new/',
          state: {widgets: [complexWidget]},
        },
      },
    });

    // Widget with all its properties should be rendered
    expect(await screen.findByTestId('sortable-widget')).toBeInTheDocument();

    // Click save to check that the widgets are passed to the API
    await userEvent.click(await screen.findByRole('button', {name: 'Save and Finish'}));
    expect(mockPOST).toHaveBeenCalledWith(
      '/organizations/org-slug/dashboards/',
      expect.objectContaining({
        data: expect.objectContaining({
          widgets: [expect.objectContaining(complexWidget)],
        }),
      })
    );
  });
});
