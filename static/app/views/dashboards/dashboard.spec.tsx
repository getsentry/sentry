import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TagsFixture} from 'sentry-fixture/tags';
import {UserFixture} from 'sentry-fixture/user';
import {WidgetFixture} from 'sentry-fixture/widget';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import PageFiltersStore from 'sentry/components/pageFilters/store';
import MemberListStore from 'sentry/stores/memberListStore';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useLocation} from 'sentry/utils/useLocation';
import Dashboard from 'sentry/views/dashboards/dashboard';
import FiltersBar from 'sentry/views/dashboards/filtersBar';
import type {DashboardDetails, Widget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {getSavedFiltersAsPageFilters} from 'sentry/views/dashboards/utils';

import WidgetLegendSelectionState from './widgetLegendSelectionState';

jest.mock('sentry/components/lazyRender', () => ({
  LazyRender: ({children}: {children: React.ReactNode}) => children,
}));

describe('Dashboards > Dashboard', () => {
  const organization = OrganizationFixture({
    features: ['dashboards-basic', 'dashboards-edit'],
  });
  const mockDashboard = {
    dateCreated: '2021-08-10T21:20:46.798237Z',
    id: '1',
    title: 'Test Dashboard',
    widgets: [],
    projects: [],
    filters: {},
  };
  const newWidget: Widget = {
    id: '1',
    title: 'Test Discover Widget',
    displayType: DisplayType.LINE,
    widgetType: WidgetType.DISCOVER,
    interval: '5m',
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
  };
  const issueWidget: Widget = {
    id: '2',
    title: 'Test Issue Widget',
    displayType: DisplayType.TABLE,
    widgetType: WidgetType.ISSUE,
    interval: '5m',
    queries: [
      {
        name: '',
        conditions: '',
        fields: ['title', 'assignee'],
        aggregates: [],
        columns: ['title', 'assignee'],
        orderby: '',
      },
    ],
  };

  const widgetLegendState = new WidgetLegendSelectionState({
    organization,
    dashboard: mockDashboard,
    navigate: jest.fn(),
    location: LocationFixture(),
  });

  let initialData: ReturnType<typeof initializeOrg>;
  let tagsMock: jest.Mock;

  beforeEach(() => {
    initialData = initializeOrg({organization, projects: []});
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/dashboards/widgets/`,
      method: 'POST',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/releases/stats/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      method: 'GET',
      body: [
        {
          annotations: [],
          id: '1',
          title: 'Error: Failed',
          project: {
            id: '3',
          },
          assignedTo: {
            email: 'test@sentry.io',
            type: 'user',
            id: '1',
            name: 'Test User',
          },
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      method: 'GET',
      body: [
        {
          user: {
            id: '2',
            name: 'test@sentry.io',
            email: 'test@sentry.io',
            avatar: {
              avatarType: 'letter_avatar',
              avatarUuid: null,
            },
          },
        },
      ],
    });
    tagsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      method: 'GET',
      body: TagsFixture(),
    });
  });

  it('fetches tags', () => {
    render(
      <Dashboard
        dashboard={mockDashboard}
        onUpdate={() => undefined}
        handleUpdateWidgetList={() => undefined}
        handleAddCustomWidget={() => undefined}
        widgetLimitReached={false}
        isEditingDashboard={false}
        widgetLegendState={widgetLegendState}
      />
    );
    expect(tagsMock).toHaveBeenCalled();
  });

  it('dashboard adds new widget if component is mounted with newWidget prop', async () => {
    const mockHandleAddCustomWidget = jest.fn();
    const mockCallbackToUnsetNewWidget = jest.fn();
    render(
      <Dashboard
        dashboard={mockDashboard}
        isEditingDashboard={false}
        onUpdate={() => undefined}
        handleUpdateWidgetList={() => undefined}
        handleAddCustomWidget={mockHandleAddCustomWidget}
        newWidget={newWidget}
        widgetLimitReached={false}
        onSetNewWidget={mockCallbackToUnsetNewWidget}
        widgetLegendState={widgetLegendState}
      />
    );
    await waitFor(() => expect(mockHandleAddCustomWidget).toHaveBeenCalled());
    expect(mockCallbackToUnsetNewWidget).toHaveBeenCalled();
  });

  it('dashboard adds new widget if component updated with newWidget prop', async () => {
    const mockHandleAddCustomWidget = jest.fn();
    const mockCallbackToUnsetNewWidget = jest.fn();
    const {rerender} = render(
      <Dashboard
        dashboard={mockDashboard}
        isEditingDashboard={false}
        onUpdate={() => undefined}
        handleUpdateWidgetList={() => undefined}
        handleAddCustomWidget={mockHandleAddCustomWidget}
        widgetLimitReached={false}
        onSetNewWidget={mockCallbackToUnsetNewWidget}
        widgetLegendState={widgetLegendState}
      />
    );
    expect(mockHandleAddCustomWidget).not.toHaveBeenCalled();
    expect(mockCallbackToUnsetNewWidget).not.toHaveBeenCalled();

    // Re-render with newWidget prop
    rerender(
      <Dashboard
        dashboard={mockDashboard}
        isEditingDashboard={false}
        onUpdate={() => undefined}
        handleUpdateWidgetList={() => undefined}
        handleAddCustomWidget={mockHandleAddCustomWidget}
        widgetLimitReached={false}
        onSetNewWidget={mockCallbackToUnsetNewWidget}
        newWidget={newWidget}
        widgetLegendState={widgetLegendState}
      />
    );
    await waitFor(() => expect(mockHandleAddCustomWidget).toHaveBeenCalled());
    expect(mockCallbackToUnsetNewWidget).toHaveBeenCalled();
  });

  it('dashboard does not try to add new widget if no newWidget', () => {
    const mockHandleAddCustomWidget = jest.fn();
    const mockCallbackToUnsetNewWidget = jest.fn();
    render(
      <Dashboard
        dashboard={mockDashboard}
        isEditingDashboard={false}
        onUpdate={() => undefined}
        handleUpdateWidgetList={() => undefined}
        handleAddCustomWidget={mockHandleAddCustomWidget}
        widgetLimitReached={false}
        onSetNewWidget={mockCallbackToUnsetNewWidget}
        widgetLegendState={widgetLegendState}
      />
    );
    expect(mockHandleAddCustomWidget).not.toHaveBeenCalled();
    expect(mockCallbackToUnsetNewWidget).not.toHaveBeenCalled();
  });

  it('handles duplicate widget in view mode', async () => {
    const mockOnUpdate = jest.fn();
    const mockHandleUpdateWidgetList = jest.fn();

    const dashboardWithOneWidget = {
      ...mockDashboard,
      widgets: [
        WidgetFixture({
          id: '1',
          layout: {
            h: 1,
            w: 1,
            x: 0,
            y: 0,
            minH: 1,
          },
        }),
      ],
    };

    render(
      <MEPSettingProvider forceTransactions={false}>
        <Dashboard
          dashboard={dashboardWithOneWidget}
          isEditingDashboard={false}
          onUpdate={mockOnUpdate}
          handleUpdateWidgetList={mockHandleUpdateWidgetList}
          handleAddCustomWidget={() => undefined}
          widgetLimitReached={false}
          onSetNewWidget={() => undefined}
          widgetLegendState={widgetLegendState}
        />
      </MEPSettingProvider>,
      {organization: initialData.organization}
    );

    await userEvent.click(await screen.findByLabelText('Widget actions'));
    await userEvent.click(await screen.findByText('Duplicate Widget'));

    // The new widget is inserted after the duplicated widget
    const expectedWidgets = [
      // Duplicated Widget
      expect.objectContaining(
        WidgetFixture({
          id: '1',
          layout: expect.objectContaining({h: 1, w: 1, x: 0, y: 0, minH: 1}),
        })
      ),
      // New Widget is appended at the end
      expect.objectContaining(
        WidgetFixture({
          id: undefined,
          layout: expect.objectContaining({h: 1, w: 1, x: 0, y: 1, minH: 1}),
        })
      ),
    ];

    expect(mockHandleUpdateWidgetList).toHaveBeenCalledWith(expectedWidgets);
    expect(mockOnUpdate).toHaveBeenCalledWith(expectedWidgets);
  });

  it('hides widget context menu when dashboard is embedded', async () => {
    const dashboardWithOneWidget = {
      ...mockDashboard,
      widgets: [
        WidgetFixture({
          id: '1',
          title: 'Test Widget',
          layout: {
            h: 1,
            w: 1,
            x: 0,
            y: 0,
            minH: 1,
          },
        }),
      ],
    };

    render(
      <MEPSettingProvider forceTransactions={false}>
        <Dashboard
          dashboard={dashboardWithOneWidget}
          isEditingDashboard={false}
          onUpdate={() => undefined}
          handleUpdateWidgetList={() => undefined}
          handleAddCustomWidget={() => undefined}
          widgetLimitReached={false}
          isEmbedded
          widgetLegendState={widgetLegendState}
        />
      </MEPSettingProvider>,
      {organization: initialData.organization}
    );

    await screen.findByText('Test Widget');
    expect(screen.queryByLabelText('Widget actions')).not.toBeInTheDocument();
  });

  describe('Issue Widgets', () => {
    beforeEach(() => {
      MemberListStore.init();
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/1/',
        method: 'GET',
        body: {
          annotations: [],
          id: '1',
          title: 'Error: Failed',
          project: {
            id: '3',
          },
          assignedTo: {
            email: 'test@sentry.io',
            type: 'user',
            id: '1',
            name: 'Test User',
          },
        },
      });
    });

    const mount = (dashboard: DashboardDetails) => {
      render(
        <MEPSettingProvider forceTransactions={false}>
          <Dashboard
            dashboard={dashboard}
            isEditingDashboard={false}
            onUpdate={() => undefined}
            handleUpdateWidgetList={() => undefined}
            handleAddCustomWidget={() => undefined}
            widgetLimitReached={false}
            widgetLegendState={widgetLegendState}
          />
        </MEPSettingProvider>,
        {organization: initialData.organization}
      );
    };

    it('dashboard displays issue widgets if the user has issue widgets feature flag', async () => {
      const mockDashboardWithIssueWidget = {
        ...mockDashboard,
        widgets: [newWidget, issueWidget],
      };

      mount(mockDashboardWithIssueWidget);
      expect(await screen.findByText('Test Discover Widget')).toBeInTheDocument();
      expect(screen.getByText('Test Issue Widget')).toBeInTheDocument();
    });

    it('renders assignee', async () => {
      MemberListStore.loadInitialData([
        UserFixture({
          name: 'Test User',
          email: 'test@sentry.io',
          avatar: {
            avatarType: 'letter_avatar',
            avatarUuid: null,
          },
        }),
      ]);
      const mockDashboardWithIssueWidget = {
        ...mockDashboard,
        widgets: [{...issueWidget}],
      };
      mount(mockDashboardWithIssueWidget);
      // Widget should render with assignee column
      expect(await screen.findByText('assignee')).toBeInTheDocument();
    });
  });

  describe('Interval selection', () => {
    // Use a SPANS widget with LINE display: both are required by
    // widgetCanUseTimeSeriesVisualization, which gates widgetInterval propagation.
    const orgWithFlag = OrganizationFixture({
      features: ['dashboards-interval-selection'],
    });
    const spansWidget: Widget = {
      id: '3',
      title: 'Test Spans Widget',
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '',
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
    };
    // session.status in columns forces useSessionAPI=true → /sessions/ endpoint,
    // matching the endpoint that surfaces the "intervals too granular" error.
    const releasesWidget: Widget = {
      id: '4',
      title: 'Test Releases Widget',
      displayType: DisplayType.LINE,
      widgetType: WidgetType.RELEASE,
      interval: '',
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['count_unique(user)'],
          aggregates: ['count_unique(user)'],
          columns: ['session.status'],
          orderby: '-count_unique(user)',
        },
      ],
    };
    // The dashboard carries a saved 24h time range — this is the source of the
    // time range, not the URL or PageFiltersStore.
    const dashboardWithWidget = {
      ...mockDashboard,
      widgets: [spansWidget],
      period: '24h',
    };

    // 30d variants used by the "URL interval not valid" tests.
    const thirtyDayDashboard: DashboardDetails = {
      ...mockDashboard,
      widgets: [spansWidget],
      period: '30d',
    };
    const thirtyDayReleaseDashboard: DashboardDetails = {
      ...mockDashboard,
      widgets: [releasesWidget],
      period: '30d',
    };

    // Minimal valid SessionApiResponse — enough for the releases hook to
    // consider the query complete without trying to render chart data.
    const emptySessionsBody = {
      start: '2021-08-07T00:00:00Z',
      end: '2021-09-06T00:00:00Z',
      query: '',
      intervals: [],
      groups: [],
    };

    // Mirrors DashboardDetailWithInjectedProps: useChartInterval always provides
    // the validated interval for the current period, keeping the FiltersBar
    // dropdown and widget requests in sync.
    // Accepts an optional dashboard prop so tests can supply a different period.
    function DashboardWithIntervalSelector({
      dashboard = dashboardWithWidget,
    }: {
      dashboard?: DashboardDetails;
    } = {}) {
      const location = useLocation();
      const [widgetInterval] = useChartInterval();
      return (
        <MEPSettingProvider forceTransactions={false}>
          <FiltersBar
            dashboard={dashboard}
            filters={{}}
            hasUnsavedChanges={false}
            isEditingDashboard={false}
            isPreview={false}
            location={location}
            onDashboardFilterChange={() => undefined}
          />
          <Dashboard
            dashboard={dashboard}
            isEditingDashboard={false}
            onUpdate={() => undefined}
            handleUpdateWidgetList={() => undefined}
            handleAddCustomWidget={() => undefined}
            widgetLimitReached={false}
            widgetLegendState={widgetLegendState}
            widgetInterval={widgetInterval}
            useTimeseriesVisualization
          />
        </MEPSettingProvider>
      );
    }

    beforeEach(() => {
      // Reset the saved page filters.
      PageFiltersStore.init();
      PageFiltersStore.onInitializeUrlState(
        getSavedFiltersAsPageFilters(dashboardWithWidget)
      );
      // FiltersBar's global filter search and releases filter trigger these
      // endpoints whenever FiltersBar mounts, even in interval-selector tests.
      MockApiClient.addMockResponse({url: '/organizations/org-slug/releases/', body: []});
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/measurements-meta/',
        body: {},
      });
    });

    describe('no interval set in URL', () => {
      it('defaults to the smallest valid interval for the dashboard period', async () => {
        const fiveMinuteMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-stats/',
          method: 'GET',
          body: [],
          match: [MockApiClient.matchQuery({interval: '5m'})],
        });
        const hourlyIntervalMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-stats/',
          method: 'GET',
          body: [],
          match: [MockApiClient.matchQuery({interval: '1h'})],
        });

        // No interval in the URL — the 5m default is derived purely from the
        // dashboard's saved 24h period via PageFiltersStore → useChartInterval.
        const {router} = render(<DashboardWithIntervalSelector />, {
          organization: orgWithFlag,
          initialRouterConfig: {location: {pathname: '/'}},
        });

        await screen.findByText('Test Spans Widget');
        await waitFor(() => expect(fiveMinuteMock).toHaveBeenCalled());
        expect(hourlyIntervalMock).not.toHaveBeenCalled();

        // Click the interval selector and choose '1 hour'. FiltersBar writes
        // interval=1h to the URL, DashboardWithIntervalSelector re-renders with
        // the new widgetInterval, and the widget re-fetches with the new interval.
        await userEvent.click(screen.getByRole('button', {name: '5 minutes'}));
        await userEvent.click(screen.getByRole('option', {name: '1 hour'}));

        await waitFor(() => expect(hourlyIntervalMock).toHaveBeenCalled());
        expect(router.location.query.interval).toBe('1h');
      });
    });

    describe('interval set in URL', () => {
      it('uses the URL interval as the selector default and queries with that interval', async () => {
        const thirtyMinuteMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-stats/',
          method: 'GET',
          body: [],
          match: [MockApiClient.matchQuery({interval: '30m'})],
        });
        const fiveMinuteMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-stats/',
          method: 'GET',
          body: [],
          match: [MockApiClient.matchQuery({interval: '5m'})],
        });

        const hourlyIntervalMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-stats/',
          method: 'GET',
          body: [],
          match: [MockApiClient.matchQuery({interval: '1h'})],
        });

        const {router} = render(<DashboardWithIntervalSelector />, {
          organization: orgWithFlag,
          initialRouterConfig: {location: {pathname: '/', query: {interval: '30m'}}},
        });

        await screen.findByText('Test Spans Widget');

        // The selector reflects the URL interval, not the period-derived default.
        expect(screen.getByRole('button', {name: '30 minutes'})).toBeInTheDocument();

        // The widget queries use the URL interval.
        await waitFor(() => expect(thirtyMinuteMock).toHaveBeenCalled());
        expect(fiveMinuteMock).not.toHaveBeenCalled();

        // Selecting a new interval updates the URL and triggers a re-fetch.
        await userEvent.click(screen.getByRole('button', {name: '30 minutes'}));
        await userEvent.click(screen.getByRole('option', {name: '1 hour'}));

        await waitFor(() => expect(hourlyIntervalMock).toHaveBeenCalled());
        expect(router.location.query.interval).toBe('1h');
      });
    });

    describe('URL interval not valid for the dashboard period', () => {
      beforeEach(() => {
        // Override the outer 24h store setup — valid intervals for 30d are 3h, 12h, 1d.
        PageFiltersStore.init();
        PageFiltersStore.onInitializeUrlState(
          getSavedFiltersAsPageFilters(thirtyDayDashboard)
        );
      });

      it('ignores the URL interval and falls back to the period default', async () => {
        const threeHourMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-stats/',
          method: 'GET',
          body: [],
          match: [MockApiClient.matchQuery({interval: '3h'})],
        });
        const fiveMinuteMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-stats/',
          method: 'GET',
          body: [],
          match: [MockApiClient.matchQuery({interval: '5m'})],
        });

        // 5m is in the URL but is not a valid interval for a 30d window.
        render(<DashboardWithIntervalSelector dashboard={thirtyDayDashboard} />, {
          organization: orgWithFlag,
          initialRouterConfig: {location: {pathname: '/', query: {interval: '5m'}}},
        });

        await screen.findByText('Test Spans Widget');

        // The selector should show the period-derived default, not the invalid URL value.
        expect(screen.getByRole('button', {name: '3 hours'})).toBeInTheDocument();

        // The widget should query with the valid default interval, not the URL value.
        await waitFor(() => expect(threeHourMock).toHaveBeenCalled());
        expect(fiveMinuteMock).not.toHaveBeenCalled();
      });
    });

    describe('URL interval not valid for the dashboard period (releases widget)', () => {
      beforeEach(() => {
        // Mirror the spans describe's 30d override but for the releases widget.
        PageFiltersStore.init();
        PageFiltersStore.onInitializeUrlState(
          getSavedFiltersAsPageFilters(thirtyDayReleaseDashboard)
        );
        // Use a date well past METRICS_BACKED_SESSIONS_START_DATE (2022-07-12) so
        // a 30d period doesn't trigger the "data only available from Jul 12" error.
        setMockDate(new Date('2024-01-15'));
      });

      afterEach(() => {
        resetMockDate();
      });

      it('ignores the URL interval and falls back to the period default', async () => {
        // Uses the /sessions/ endpoint (session.status in columns → useSessionAPI=true),
        // which surfaces the "intervals too granular" error in production.
        const threeHourMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/sessions/',
          method: 'GET',
          body: emptySessionsBody,
          match: [MockApiClient.matchQuery({interval: '3h'})],
        });
        const fiveMinuteMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/sessions/',
          method: 'GET',
          body: emptySessionsBody,
          match: [MockApiClient.matchQuery({interval: '5m'})],
        });

        render(<DashboardWithIntervalSelector dashboard={thirtyDayReleaseDashboard} />, {
          organization: orgWithFlag,
          initialRouterConfig: {location: {pathname: '/', query: {interval: '5m'}}},
        });

        await screen.findByText('Test Releases Widget');

        // The selector should show the period-derived default (3h), not the
        // invalid URL value (5m).
        expect(screen.getByRole('button', {name: '3 hours'})).toBeInTheDocument();

        // The widget should query the sessions endpoint with the valid default
        // interval, not the 5m value from the URL.
        await waitFor(() => expect(threeHourMock).toHaveBeenCalled());
        expect(fiveMinuteMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('Edit mode', () => {
    let widgets: Widget[];
    const mount = ({dashboard, isPreview = false, onEditWidget = jest.fn()}: any) => {
      const getDashboardComponent = () => (
        <MEPSettingProvider forceTransactions={false}>
          <Dashboard
            dashboard={dashboard}
            isEditingDashboard
            onUpdate={newWidgets => {
              widgets.splice(0, widgets.length, ...newWidgets);
            }}
            handleUpdateWidgetList={() => undefined}
            handleAddCustomWidget={() => undefined}
            widgetLimitReached={false}
            isPreview={isPreview}
            onEditWidget={onEditWidget}
            widgetLegendState={widgetLegendState}
          />
        </MEPSettingProvider>
      );
      const {rerender} = render(getDashboardComponent(), {
        organization: initialData.organization,
      });
      return {rerender: () => rerender(getDashboardComponent())};
    };

    beforeEach(() => {
      widgets = [newWidget];
    });

    it('displays the copy widget button in edit mode', async () => {
      const dashboardWithOneWidget = {...mockDashboard, widgets};

      mount({dashboard: dashboardWithOneWidget});
      expect(await screen.findByLabelText('Duplicate Widget')).toBeInTheDocument();
    });

    it('duplicates the widget', async () => {
      const dashboardWithOneWidget = {...mockDashboard, widgets};
      const {rerender} = mount({dashboard: dashboardWithOneWidget});

      await userEvent.click(await screen.findByLabelText('Duplicate Widget'));
      rerender();

      await waitFor(() => {
        expect(screen.getAllByText('Test Discover Widget')).toHaveLength(2);
      });
    });

    it('triggers the edit widget callback', async () => {
      const testData = initializeOrg({
        organization: {
          features: ['dashboards-basic', 'dashboards-edit'],
        },
      });
      const dashboardWithOneWidget = {
        ...mockDashboard,
        widgets: [newWidget],
      };
      const mockOnEditWidget = jest.fn();

      mount({
        dashboard: dashboardWithOneWidget,
        org: testData.organization,
        location: testData.router.location,
        onEditWidget: mockOnEditWidget,
      });

      await userEvent.click(await screen.findByLabelText('Edit Widget'));

      await waitFor(() => {
        expect(mockOnEditWidget).toHaveBeenCalled();
      });
    });

    it('does not show the add widget button if dashboard is in preview mode', async () => {
      const testData = initializeOrg({
        organization: {
          features: ['dashboards-basic', 'dashboards-edit'],
        },
      });
      const dashboardWithOneWidget = {
        ...mockDashboard,
        widgets: [newWidget],
      };

      mount({
        dashboard: dashboardWithOneWidget,
        org: testData.organization,
        isPreview: true,
      });

      await screen.findByText('Test Discover Widget');

      expect(screen.queryByRole('button', {name: /add widget/i})).not.toBeInTheDocument();
    });
  });
});
