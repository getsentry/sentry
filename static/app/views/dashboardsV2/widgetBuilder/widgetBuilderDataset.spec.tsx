import selectEvent from 'react-select-event';
import {urlEncode} from '@sentry/utils';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import TagStore from 'sentry/stores/tagStore';
import {
  DashboardDetails,
  DashboardWidgetSource,
  DisplayType,
  Widget,
  WidgetType,
} from 'sentry/views/dashboardsV2/types';
import WidgetBuilder, {WidgetBuilderProps} from 'sentry/views/dashboardsV2/widgetBuilder';

const defaultOrgFeatures = [
  'performance-view',
  'dashboards-edit',
  'global-views',
  'dashboards-mep',
];

// Mocking worldMapChart to avoid act warnings
jest.mock('sentry/components/charts/worldMapChart', () => ({
  WorldMapChart: () => null,
}));

function mockDashboard(dashboard: Partial<DashboardDetails>): DashboardDetails {
  return {
    id: '1',
    title: 'Dashboard',
    createdBy: undefined,
    dateCreated: '2020-01-01T00:00:00.000Z',
    widgets: [],
    projects: [],
    filters: {},
    ...dashboard,
  };
}

function renderTestComponent({
  dashboard,
  query,
  orgFeatures,
  onSave,
  params,
}: {
  dashboard?: WidgetBuilderProps['dashboard'];
  onSave?: WidgetBuilderProps['onSave'];
  orgFeatures?: string[];
  params?: Partial<WidgetBuilderProps['params']>;
  query?: Record<string, any>;
} = {}) {
  const {organization, router, routerContext} = initializeOrg({
    ...initializeOrg(),
    organization: {
      features: orgFeatures ?? defaultOrgFeatures,
    },
    router: {
      location: {
        query: {
          source: DashboardWidgetSource.DASHBOARDS,
          ...query,
        },
      },
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
        ...dashboard,
      }}
      onSave={onSave ?? jest.fn()}
      params={{
        orgId: organization.slug,
        dashboardId: dashboard?.id ?? 'new',
        ...params,
      }}
    />,
    {
      context: routerContext,
      organization,
    }
  );

  return {router};
}

describe('WidgetBuilder', function () {
  const untitledDashboard: DashboardDetails = {
    id: '1',
    title: 'Untitled Dashboard',
    createdBy: undefined,
    dateCreated: '2020-01-01T00:00:00.000Z',
    widgets: [],
    projects: [],
    filters: {},
  };

  const testDashboard: DashboardDetails = {
    id: '2',
    title: 'Test Dashboard',
    createdBy: undefined,
    dateCreated: '2020-01-01T00:00:00.000Z',
    widgets: [],
    projects: [],
    filters: {},
  };

  let eventsMock: jest.Mock | undefined;
  let sessionsDataMock: jest.Mock | undefined;
  let metricsDataMock: jest.Mock | undefined;
  let measurementsMetaMock: jest.Mock | undefined;

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [
        {...untitledDashboard, widgetDisplay: [DisplayType.TABLE]},
        {...testDashboard, widgetDisplay: [DisplayType.AREA]},
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/widgets/',
      method: 'POST',
      statusCode: 200,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      method: 'GET',
      statusCode: 200,
      body: {
        meta: {},
        data: [],
      },
    });

    eventsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      method: 'GET',
      statusCode: 200,
      body: {
        meta: {fields: {}},
        data: [],
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/event.type/values/',
      body: [{count: 2, name: 'Nvidia 1080ti'}],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-geo/',
      body: {data: [], meta: {}},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });

    sessionsDataMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/sessions/',
      body: TestStubs.SessionsField({
        field: `sum(session)`,
      }),
    });

    metricsDataMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/metrics/data/',
      body: TestStubs.MetricsField({
        field: 'sum(sentry.sessions.session)',
      }),
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      method: 'GET',
      body: TestStubs.Tags(),
    });

    measurementsMetaMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/measurements-meta/',
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/is/values/',
      method: 'GET',
      body: [],
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

    TagStore.reset();
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Release Widgets', function () {
    const releaseHealthFeatureFlags = [...defaultOrgFeatures, 'dashboards-releases'];

    it('does not show the Release Health dataset if there is no dashboards-releases flag', async function () {
      renderTestComponent({
        orgFeatures: [...defaultOrgFeatures],
      });

      expect(await screen.findByText('Errors and Transactions')).toBeInTheDocument();
      expect(
        screen.queryByText('Releases (Sessions, Crash rates)')
      ).not.toBeInTheDocument();
    });

    it('shows the Release Health dataset if there is the dashboards-releases flag', async function () {
      renderTestComponent({
        orgFeatures: releaseHealthFeatureFlags,
      });

      expect(await screen.findByText('Errors and Transactions')).toBeInTheDocument();
      expect(screen.getByText('Releases (Sessions, Crash rates)')).toBeInTheDocument();
    });

    it('maintains the selected dataset when display type is changed', async function () {
      renderTestComponent({
        orgFeatures: releaseHealthFeatureFlags,
      });

      expect(
        await screen.findByText('Releases (Sessions, Crash rates)')
      ).toBeInTheDocument();

      expect(screen.getByLabelText(/releases/i)).not.toBeChecked();
      userEvent.click(screen.getByLabelText(/releases/i));
      await waitFor(() => expect(screen.getByLabelText(/releases/i)).toBeChecked());

      userEvent.click(screen.getByText('Table'));
      userEvent.click(screen.getByText('Line Chart'));
      await waitFor(() => expect(screen.getByLabelText(/releases/i)).toBeChecked());
    });

    it('displays releases tags', async function () {
      renderTestComponent({
        orgFeatures: releaseHealthFeatureFlags,
      });

      expect(
        await screen.findByText('Releases (Sessions, Crash rates)')
      ).toBeInTheDocument();

      userEvent.click(screen.getByLabelText(/releases/i));

      expect(screen.getByText('crash_free_rate(…)')).toBeInTheDocument();
      expect(screen.getByText('session')).toBeInTheDocument();

      userEvent.click(screen.getByText('crash_free_rate(…)'));
      expect(screen.getByText('count_unique(…)')).toBeInTheDocument();

      expect(screen.getByText('release')).toBeInTheDocument();
      expect(screen.getByText('environment')).toBeInTheDocument();
      expect(screen.getByText('session.status')).toBeInTheDocument();

      userEvent.click(screen.getByText('count_unique(…)'));
      expect(screen.getByText('user')).toBeInTheDocument();
    });

    it('does not display tags as params', async function () {
      renderTestComponent({
        orgFeatures: releaseHealthFeatureFlags,
      });

      expect(
        await screen.findByText('Releases (Sessions, Crash rates)')
      ).toBeInTheDocument();

      userEvent.click(screen.getByLabelText(/releases/i));

      expect(screen.getByText('crash_free_rate(…)')).toBeInTheDocument();
      await selectEvent.select(screen.getByText('crash_free_rate(…)'), 'count_unique(…)');

      userEvent.click(screen.getByText('user'));
      expect(screen.queryByText('release')).not.toBeInTheDocument();
      expect(screen.queryByText('environment')).not.toBeInTheDocument();
      expect(screen.queryByText('session.status')).not.toBeInTheDocument();
    });

    it('does not allow sort by when session.status is selected', async function () {
      renderTestComponent({
        orgFeatures: releaseHealthFeatureFlags,
      });

      expect(
        await screen.findByText('Releases (Sessions, Crash rates)')
      ).toBeInTheDocument();

      userEvent.click(screen.getByLabelText(/releases/i));

      expect(screen.getByText('High to low')).toBeEnabled();
      expect(screen.getByText('crash_free_rate(session)')).toBeInTheDocument();

      userEvent.click(screen.getByLabelText('Add a Column'));
      await selectEvent.select(screen.getByText('(Required)'), 'session.status');

      expect(screen.getByRole('textbox', {name: 'Sort direction'})).toBeDisabled();
      expect(screen.getByRole('textbox', {name: 'Sort by'})).toBeDisabled();
    });

    it('does not allow sort on tags except release', async function () {
      jest.useFakeTimers().setSystemTime(new Date('2022-08-02'));
      renderTestComponent({
        orgFeatures: releaseHealthFeatureFlags,
      });

      expect(
        await screen.findByText('Releases (Sessions, Crash rates)')
      ).toBeInTheDocument();

      userEvent.click(screen.getByLabelText(/releases/i));

      expect(screen.getByText('High to low')).toBeEnabled();
      expect(screen.getByText('crash_free_rate(session)')).toBeInTheDocument();

      userEvent.click(screen.getByLabelText('Add a Column'));
      await selectEvent.select(screen.getByText('(Required)'), 'release');

      userEvent.click(screen.getByLabelText('Add a Column'));
      await selectEvent.select(screen.getByText('(Required)'), 'environment');

      expect(await screen.findByText('Sort by a column')).toBeInTheDocument();

      // Selector "sortDirection"
      expect(screen.getByText('High to low')).toBeInTheDocument();

      // Selector "sortBy"
      userEvent.click(screen.getAllByText('crash_free_rate(session)')[1]);

      // release exists in sort by selector
      expect(screen.getAllByText('release')).toHaveLength(3);
      // environment does not exist in sort by selector
      expect(screen.getAllByText('environment')).toHaveLength(2);
    });

    it('makes the appropriate sessions call', async function () {
      jest.useFakeTimers().setSystemTime(new Date('2022-08-02'));
      renderTestComponent({
        orgFeatures: releaseHealthFeatureFlags,
      });

      expect(
        await screen.findByText('Releases (Sessions, Crash rates)')
      ).toBeInTheDocument();

      userEvent.click(screen.getByLabelText(/releases/i));

      userEvent.click(screen.getByText('Table'));
      userEvent.click(screen.getByText('Line Chart'));

      await waitFor(() =>
        expect(metricsDataMock).toHaveBeenLastCalledWith(
          `/organizations/org-slug/metrics/data/`,
          expect.objectContaining({
            query: expect.objectContaining({
              environment: [],
              field: [`session.crash_free_rate`],
              groupBy: [],
              interval: '5m',
              project: [],
              statsPeriod: '24h',
            }),
          })
        )
      );
    });

    it('calls the session endpoint with the right limit', async function () {
      jest.useFakeTimers().setSystemTime(new Date('2022-08-02'));
      renderTestComponent({
        orgFeatures: releaseHealthFeatureFlags,
      });

      expect(
        await screen.findByText('Releases (Sessions, Crash rates)')
      ).toBeInTheDocument();

      userEvent.click(screen.getByLabelText(/releases/i));

      userEvent.click(screen.getByText('Table'));
      userEvent.click(screen.getByText('Line Chart'));

      await selectEvent.select(await screen.findByText('Select group'), 'project');

      expect(screen.getByText('Limit to 5 results')).toBeInTheDocument();

      await waitFor(() =>
        expect(metricsDataMock).toHaveBeenLastCalledWith(
          `/organizations/org-slug/metrics/data/`,
          expect.objectContaining({
            query: expect.objectContaining({
              environment: [],
              field: ['session.crash_free_rate'],
              groupBy: ['project_id'],
              interval: '5m',
              orderBy: '-session.crash_free_rate',
              per_page: 5,
              project: [],
              statsPeriod: '24h',
            }),
          })
        )
      );
    });

    it('calls sessions api when session.status is selected as a groupby', async function () {
      jest.useFakeTimers().setSystemTime(new Date('2022-08-02'));
      renderTestComponent({
        orgFeatures: releaseHealthFeatureFlags,
      });

      expect(
        await screen.findByText('Releases (Sessions, Crash rates)')
      ).toBeInTheDocument();

      userEvent.click(screen.getByLabelText(/releases/i));

      userEvent.click(screen.getByText('Table'));
      userEvent.click(screen.getByText('Line Chart'));

      await selectEvent.select(await screen.findByText('Select group'), 'session.status');

      expect(screen.getByText('Limit to 5 results')).toBeInTheDocument();

      await waitFor(() =>
        expect(sessionsDataMock).toHaveBeenLastCalledWith(
          `/organizations/org-slug/sessions/`,
          expect.objectContaining({
            query: expect.objectContaining({
              environment: [],
              field: ['crash_free_rate(session)'],
              groupBy: ['session.status'],
              interval: '5m',
              project: [],
              statsPeriod: '24h',
            }),
          })
        )
      );
    });

    it('displays the correct options for area chart', async function () {
      renderTestComponent({
        orgFeatures: releaseHealthFeatureFlags,
      });

      expect(
        await screen.findByText('Releases (Sessions, Crash rates)')
      ).toBeInTheDocument();

      // change dataset to releases
      userEvent.click(screen.getByLabelText(/releases/i));

      userEvent.click(screen.getByText('Table'));
      userEvent.click(screen.getByText('Line Chart'));

      expect(screen.getByText('crash_free_rate(…)')).toBeInTheDocument();
      expect(screen.getByText(`session`)).toBeInTheDocument();

      userEvent.click(screen.getByText('crash_free_rate(…)'));
      expect(screen.getByText('count_unique(…)')).toBeInTheDocument();

      userEvent.click(screen.getByText('count_unique(…)'));
      expect(screen.getByText('user')).toBeInTheDocument();
    });

    it('sets widgetType to release', async function () {
      jest.useFakeTimers().setSystemTime(new Date('2022-08-02'));
      renderTestComponent({
        orgFeatures: releaseHealthFeatureFlags,
      });

      userEvent.click(await screen.findByText('Releases (Sessions, Crash rates)'));

      expect(metricsDataMock).toHaveBeenCalled();
      expect(screen.getByLabelText(/Releases/i)).toBeChecked();
    });

    it('does not display "add an equation" button', async function () {
      const widget: Widget = {
        title: 'Release Widget',
        displayType: DisplayType.TABLE,
        widgetType: WidgetType.RELEASE,
        queries: [
          {
            name: 'errors',
            conditions: 'event.type:error',
            fields: ['sdk.name', 'count()'],
            columns: ['sdk.name'],
            aggregates: ['count()'],
            orderby: '-sdk.name',
          },
        ],
        interval: '1d',
        id: '1',
      };

      const dashboard = mockDashboard({widgets: [widget]});

      renderTestComponent({
        orgFeatures: releaseHealthFeatureFlags,
        dashboard,
        params: {
          widgetIndex: '0',
        },
      });

      // Select line chart display
      userEvent.click(await screen.findByText('Table'));
      userEvent.click(screen.getByText('Line Chart'));

      await waitFor(() =>
        expect(screen.queryByLabelText('Add an Equation')).not.toBeInTheDocument()
      );
    });

    it('render release dataset disabled when the display type is world map', async function () {
      renderTestComponent({
        query: {
          source: DashboardWidgetSource.DISCOVERV2,
        },
        orgFeatures: releaseHealthFeatureFlags,
      });

      userEvent.click(await screen.findByText('Table'));
      userEvent.click(screen.getByText('World Map'));

      await waitFor(() => expect(screen.getByLabelText(/Releases/)).toBeDisabled());

      expect(
        screen.getByRole('radio', {
          name: 'Errors and Transactions',
        })
      ).toBeEnabled();
      expect(
        screen.getByRole('radio', {
          name: 'Issues (States, Assignment, Time, etc.)',
        })
      ).toBeDisabled();
    });

    it('renders with a release search bar', async function () {
      renderTestComponent({
        orgFeatures: releaseHealthFeatureFlags,
      });

      userEvent.type(
        await screen.findByPlaceholderText('Search for events, users, tags, and more'),
        'session.status:'
      );

      await waitFor(() => {
        expect(screen.getByText("isn't supported here.")).toBeInTheDocument();
      });

      userEvent.click(screen.getByText('Releases (Sessions, Crash rates)'));
      userEvent.click(
        screen.getByPlaceholderText(
          'Search for release version, session status, and more'
        )
      );
      expect(await screen.findByText('environment')).toBeInTheDocument();
      expect(screen.getByText('project')).toBeInTheDocument();
      expect(screen.getByText('release')).toBeInTheDocument();
    });

    it('adds a function when the only column chosen in a table is a tag', async function () {
      jest.useFakeTimers().setSystemTime(new Date('2022-08-02'));
      renderTestComponent({
        orgFeatures: releaseHealthFeatureFlags,
      });

      userEvent.click(await screen.findByText('Releases (Sessions, Crash rates)'));

      await selectEvent.select(screen.getByText('crash_free_rate(…)'), 'environment');

      // 1 in the table header, 1 in the column selector, and 1 in the sort by
      expect(screen.getAllByText(/crash_free_rate/)).toHaveLength(3);
      expect(screen.getAllByText('environment')).toHaveLength(2);
    });
  });

  describe('Issue Widgets', function () {
    it('sets widgetType to issues', async function () {
      const handleSave = jest.fn();

      renderTestComponent({onSave: handleSave});

      userEvent.click(await screen.findByText('Issues (States, Assignment, Time, etc.)'));
      userEvent.click(screen.getByLabelText('Add Widget'));

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith([
          expect.objectContaining({
            title: 'Custom Widget',
            displayType: DisplayType.TABLE,
            interval: '5m',
            widgetType: WidgetType.ISSUE,
            queries: [
              {
                conditions: '',
                fields: ['issue', 'assignee', 'title'],
                columns: ['issue', 'assignee', 'title'],
                aggregates: [],
                fieldAliases: [],
                name: '',
                orderby: 'date',
              },
            ],
          }),
        ]);
      });

      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    it('render issues dataset disabled when the display type is not set to table', async function () {
      renderTestComponent({
        query: {
          source: DashboardWidgetSource.DISCOVERV2,
        },
      });

      userEvent.click(await screen.findByText('Table'));
      userEvent.click(screen.getByText('Line Chart'));
      expect(
        screen.getByRole('radio', {
          name: 'Errors and Transactions',
        })
      ).toBeEnabled();
      expect(
        screen.getByRole('radio', {
          name: 'Issues (States, Assignment, Time, etc.)',
        })
      ).toBeDisabled();
    });

    it('disables moving and deleting issue column', async function () {
      renderTestComponent();

      userEvent.click(await screen.findByText('Issues (States, Assignment, Time, etc.)'));
      expect(screen.getByText('issue')).toBeInTheDocument();
      expect(screen.getByText('assignee')).toBeInTheDocument();
      expect(screen.getByText('title')).toBeInTheDocument();
      expect(screen.getAllByLabelText('Remove column')).toHaveLength(2);
      expect(screen.getAllByLabelText('Drag to reorder')).toHaveLength(3);

      userEvent.click(screen.getAllByLabelText('Remove column')[1]);
      userEvent.click(screen.getAllByLabelText('Remove column')[0]);

      expect(screen.getByText('issue')).toBeInTheDocument();
      expect(screen.queryByText('assignee')).not.toBeInTheDocument();
      expect(screen.queryByText('title')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Remove column')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Drag to reorder')).not.toBeInTheDocument();
    });

    it('issue query does not work on default search bar', async function () {
      renderTestComponent();

      const input = (await screen.findByPlaceholderText(
        'Search for events, users, tags, and more'
      )) as HTMLTextAreaElement;
      userEvent.paste(input, 'bookmarks', {
        clipboardData: {getData: () => ''},
      } as unknown as React.ClipboardEvent<HTMLTextAreaElement>);
      input.setSelectionRange(9, 9);

      expect(await screen.findByText('No items found')).toBeInTheDocument();
    });

    it('renders with an issues search bar when selected in dataset selection', async function () {
      renderTestComponent();

      userEvent.click(await screen.findByText('Issues (States, Assignment, Time, etc.)'));

      const input = (await screen.findByPlaceholderText(
        'Search for issues, status, assigned, and more'
      )) as HTMLTextAreaElement;
      userEvent.paste(input, 'is:', {
        clipboardData: {getData: () => ''},
      } as unknown as React.ClipboardEvent<HTMLTextAreaElement>);
      input.setSelectionRange(3, 3);

      expect(await screen.findByText('resolved')).toBeInTheDocument();
    });

    it('Update table header values (field alias)', async function () {
      const handleSave = jest.fn();

      renderTestComponent({
        onSave: handleSave,
        orgFeatures: [...defaultOrgFeatures],
      });

      await screen.findByText('Table');

      userEvent.click(screen.getByText('Issues (States, Assignment, Time, etc.)'));

      userEvent.paste(screen.getAllByPlaceholderText('Alias')[0], 'First Alias');

      userEvent.click(screen.getByText('Add Widget'));

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith([
          expect.objectContaining({
            queries: [
              expect.objectContaining({
                fieldAliases: ['First Alias', '', ''],
              }),
            ],
          }),
        ]);
      });
    });
  });
  describe('Events Widgets', function () {
    describe('Custom Performance Metrics', function () {
      it('can choose a custom measurement', async function () {
        measurementsMetaMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/measurements-meta/',
          method: 'GET',
          body: {'measurements.custom.measurement': {functions: ['p99']}},
        });

        eventsMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
          method: 'GET',
          statusCode: 200,
          body: {
            meta: {
              fields: {'p99(measurements.total.db.calls)': 'duration'},
              isMetricsData: true,
            },
            data: [{'p99(measurements.total.db.calls)': 10}],
          },
        });

        const {router} = renderTestComponent({
          query: {source: DashboardWidgetSource.DISCOVERV2},
          dashboard: testDashboard,
          orgFeatures: [...defaultOrgFeatures, 'discover-frontend-use-events-endpoint'],
        });

        expect(await screen.findAllByText('Custom Widget')).toHaveLength(2);

        // 1 in the table header, 1 in the column selector, 1 in the sort field
        const countFields = screen.getAllByText('count()');
        expect(countFields).toHaveLength(3);

        await selectEvent.select(countFields[1], ['p99(…)']);
        await selectEvent.select(screen.getByText('transaction.duration'), [
          'measurements.custom.measurement',
        ]);

        userEvent.click(screen.getByText('Add Widget'));

        await waitFor(() => {
          expect(router.push).toHaveBeenCalledWith(
            expect.objectContaining({
              pathname: '/organizations/org-slug/dashboard/2/',
              query: {
                displayType: 'table',
                interval: '5m',
                title: 'Custom Widget',
                queryNames: [''],
                queryConditions: [''],
                queryFields: ['p99(measurements.custom.measurement)'],
                queryOrderby: '-p99(measurements.custom.measurement)',
                start: null,
                end: null,
                statsPeriod: '24h',
                utc: null,
                project: [],
                environment: [],
              },
            })
          );
        });
      });

      it('raises an alert banner but allows saving widget if widget result is not metrics data and widget is using custom measurements', async function () {
        eventsMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
          method: 'GET',
          statusCode: 200,
          body: {
            meta: {
              fields: {'p99(measurements.custom.measurement)': 'duration'},
              isMetricsData: false,
            },
            data: [{'p99(measurements.custom.measurement)': 10}],
          },
        });

        const defaultWidgetQuery = {
          name: '',
          fields: ['p99(measurements.custom.measurement)'],
          columns: [],
          aggregates: ['p99(measurements.custom.measurement)'],
          conditions: 'user:test.user@sentry.io',
          orderby: '',
        };

        const defaultTableColumns = ['p99(measurements.custom.measurement)'];

        renderTestComponent({
          query: {
            source: DashboardWidgetSource.DISCOVERV2,
            defaultWidgetQuery: urlEncode(defaultWidgetQuery),
            displayType: DisplayType.TABLE,
            defaultTableColumns,
          },
          orgFeatures: [
            ...defaultOrgFeatures,
            'discover-frontend-use-events-endpoint',
            'dashboards-mep',
            'server-side-sampling',
            'mep-rollout-flag',
          ],
        });

        await waitFor(() => {
          expect(measurementsMetaMock).toHaveBeenCalled();
        });

        await waitFor(() => {
          expect(eventsMock).toHaveBeenCalled();
        });

        screen.getByText('Your selection is only applicable to');
        expect(screen.getByText('Add Widget').closest('button')).toBeEnabled();
      });

      it('raises an alert banner if widget result is not metrics data', async function () {
        eventsMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
          method: 'GET',
          statusCode: 200,
          body: {
            meta: {
              fields: {'p99(measurements.lcp)': 'duration'},
              isMetricsData: false,
            },
            data: [{'p99(measurements.lcp)': 10}],
          },
        });

        const defaultWidgetQuery = {
          name: '',
          fields: ['p99(measurements.lcp)'],
          columns: [],
          aggregates: ['p99(measurements.lcp)'],
          conditions: 'user:test.user@sentry.io',
          orderby: '',
        };

        const defaultTableColumns = ['p99(measurements.lcp)'];

        renderTestComponent({
          query: {
            source: DashboardWidgetSource.DISCOVERV2,
            defaultWidgetQuery: urlEncode(defaultWidgetQuery),
            displayType: DisplayType.TABLE,
            defaultTableColumns,
          },
          orgFeatures: [
            ...defaultOrgFeatures,
            'discover-frontend-use-events-endpoint',
            'dashboards-mep',
            'server-side-sampling',
            'mep-rollout-flag',
          ],
        });

        await waitFor(() => {
          expect(measurementsMetaMock).toHaveBeenCalled();
        });

        await waitFor(() => {
          expect(eventsMock).toHaveBeenCalled();
        });

        screen.getByText('Your selection is only applicable to');
      });

      it('does not raise an alert banner if widget result is not metrics data but widget contains error fields', async function () {
        eventsMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
          method: 'GET',
          statusCode: 200,
          body: {
            meta: {
              fields: {'p99(measurements.lcp)': 'duration'},
              isMetricsData: false,
            },
            data: [{'p99(measurements.lcp)': 10}],
          },
        });

        const defaultWidgetQuery = {
          name: '',
          fields: ['p99(measurements.lcp)'],
          columns: ['error.handled'],
          aggregates: ['p99(measurements.lcp)'],
          conditions: 'user:test.user@sentry.io',
          orderby: '',
        };

        const defaultTableColumns = ['p99(measurements.lcp)'];

        renderTestComponent({
          query: {
            source: DashboardWidgetSource.DISCOVERV2,
            defaultWidgetQuery: urlEncode(defaultWidgetQuery),
            displayType: DisplayType.TABLE,
            defaultTableColumns,
          },
          orgFeatures: [
            ...defaultOrgFeatures,
            'discover-frontend-use-events-endpoint',
            'dashboards-mep',
          ],
        });

        await waitFor(() => {
          expect(measurementsMetaMock).toHaveBeenCalled();
        });

        await waitFor(() => {
          expect(eventsMock).toHaveBeenCalled();
        });

        expect(
          screen.queryByText('Your selection is only applicable to')
        ).not.toBeInTheDocument();
      });

      it('only displays custom measurements in supported functions', async function () {
        measurementsMetaMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/measurements-meta/',
          method: 'GET',
          body: {
            'measurements.custom.measurement': {functions: ['p99']},
            'measurements.another.custom.measurement': {functions: ['p95']},
          },
        });

        renderTestComponent({
          query: {source: DashboardWidgetSource.DISCOVERV2},
          dashboard: testDashboard,
          orgFeatures: [...defaultOrgFeatures, 'discover-frontend-use-events-endpoint'],
        });

        expect(await screen.findAllByText('Custom Widget')).toHaveLength(2);

        await selectEvent.select(screen.getAllByText('count()')[1], ['p99(…)']);
        userEvent.click(screen.getByText('transaction.duration'));
        screen.getByText('measurements.custom.measurement');
        expect(
          screen.queryByText('measurements.another.custom.measurement')
        ).not.toBeInTheDocument();
        await selectEvent.select(screen.getAllByText('p99(…)')[0], ['p95(…)']);
        userEvent.click(screen.getByText('transaction.duration'));
        screen.getByText('measurements.another.custom.measurement');
        expect(
          screen.queryByText('measurements.custom.measurement')
        ).not.toBeInTheDocument();
      });

      it('renders custom performance metric using duration units from events meta', async function () {
        eventsMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
          method: 'GET',
          statusCode: 200,
          body: {
            meta: {
              fields: {'p99(measurements.custom.measurement)': 'duration'},
              isMetricsData: true,
              units: {'p99(measurements.custom.measurement)': 'hour'},
            },
            data: [{'p99(measurements.custom.measurement)': 12}],
          },
        });

        renderTestComponent({
          query: {source: DashboardWidgetSource.DISCOVERV2},
          dashboard: {
            ...testDashboard,
            widgets: [
              {
                title: 'Custom Measurement Widget',
                interval: '1d',
                id: '1',
                widgetType: WidgetType.DISCOVER,
                displayType: DisplayType.TABLE,
                queries: [
                  {
                    conditions: '',
                    name: '',
                    fields: ['p99(measurements.custom.measurement)'],
                    columns: [],
                    aggregates: ['p99(measurements.custom.measurement)'],
                    orderby: '-p99(measurements.custom.measurement)',
                  },
                ],
              },
            ],
          },
          params: {
            widgetIndex: '0',
          },
          orgFeatures: [...defaultOrgFeatures, 'discover-frontend-use-events-endpoint'],
        });

        await screen.findByText('12.00hr');
      });

      it('renders custom performance metric using size units from events meta', async function () {
        eventsMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
          method: 'GET',
          statusCode: 200,
          body: {
            meta: {
              fields: {'p99(measurements.custom.measurement)': 'size'},
              isMetricsData: true,
              units: {'p99(measurements.custom.measurement)': 'kibibyte'},
            },
            data: [{'p99(measurements.custom.measurement)': 12}],
          },
        });

        renderTestComponent({
          query: {source: DashboardWidgetSource.DISCOVERV2},
          dashboard: {
            ...testDashboard,
            widgets: [
              {
                title: 'Custom Measurement Widget',
                interval: '1d',
                id: '1',
                widgetType: WidgetType.DISCOVER,
                displayType: DisplayType.TABLE,
                queries: [
                  {
                    conditions: '',
                    name: '',
                    fields: ['p99(measurements.custom.measurement)'],
                    columns: [],
                    aggregates: ['p99(measurements.custom.measurement)'],
                    orderby: '-p99(measurements.custom.measurement)',
                  },
                ],
              },
            ],
          },
          params: {
            widgetIndex: '0',
          },
          orgFeatures: [...defaultOrgFeatures, 'discover-frontend-use-events-endpoint'],
        });

        await screen.findByText('12.0 KiB');
      });

      it('renders custom performance metric using abyte format size units from events meta', async function () {
        eventsMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
          method: 'GET',
          statusCode: 200,
          body: {
            meta: {
              fields: {'p99(measurements.custom.measurement)': 'size'},
              isMetricsData: true,
              units: {'p99(measurements.custom.measurement)': 'kilobyte'},
            },
            data: [{'p99(measurements.custom.measurement)': 12000}],
          },
        });

        renderTestComponent({
          query: {source: DashboardWidgetSource.DISCOVERV2},
          dashboard: {
            ...testDashboard,
            widgets: [
              {
                title: 'Custom Measurement Widget',
                interval: '1d',
                id: '1',
                widgetType: WidgetType.DISCOVER,
                displayType: DisplayType.TABLE,
                queries: [
                  {
                    conditions: '',
                    name: '',
                    fields: ['p99(measurements.custom.measurement)'],
                    columns: [],
                    aggregates: ['p99(measurements.custom.measurement)'],
                    orderby: '-p99(measurements.custom.measurement)',
                  },
                ],
              },
            ],
          },
          params: {
            widgetIndex: '0',
          },
          orgFeatures: [...defaultOrgFeatures, 'discover-frontend-use-events-endpoint'],
        });

        await screen.findByText('12 MB');
      });

      it('displays saved custom performance metric in column select', async function () {
        renderTestComponent({
          query: {source: DashboardWidgetSource.DISCOVERV2},
          dashboard: {
            ...testDashboard,
            widgets: [
              {
                title: 'Custom Measurement Widget',
                interval: '1d',
                id: '1',
                widgetType: WidgetType.DISCOVER,
                displayType: DisplayType.TABLE,
                queries: [
                  {
                    conditions: '',
                    name: '',
                    fields: ['p99(measurements.custom.measurement)'],
                    columns: [],
                    aggregates: ['p99(measurements.custom.measurement)'],
                    orderby: '-p99(measurements.custom.measurement)',
                  },
                ],
              },
            ],
          },
          params: {
            widgetIndex: '0',
          },
          orgFeatures: [...defaultOrgFeatures, 'discover-frontend-use-events-endpoint'],
        });
        await screen.findByText('measurements.custom.measurement');
      });

      it('displays custom performance metric in column select dropdown', async function () {
        measurementsMetaMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/measurements-meta/',
          method: 'GET',
          body: {'measurements.custom.measurement': {functions: ['p99']}},
        });
        renderTestComponent({
          query: {source: DashboardWidgetSource.DISCOVERV2},
          dashboard: {
            ...testDashboard,
            widgets: [
              {
                title: 'Custom Measurement Widget',
                interval: '1d',
                id: '1',
                widgetType: WidgetType.DISCOVER,
                displayType: DisplayType.TABLE,
                queries: [
                  {
                    conditions: '',
                    name: '',
                    fields: ['transaction', 'count()'],
                    columns: ['transaction'],
                    aggregates: ['count()'],
                    orderby: '-count()',
                  },
                ],
              },
            ],
          },
          params: {
            widgetIndex: '0',
          },
          orgFeatures: [...defaultOrgFeatures, 'discover-frontend-use-events-endpoint'],
        });
        await screen.findByText('transaction');
        userEvent.click(screen.getAllByText('count()')[1]);
        expect(screen.getByText('measurements.custom.measurement')).toBeInTheDocument();
      });

      it('does not default to sorting by transaction when columns change', async function () {
        renderTestComponent({
          query: {source: DashboardWidgetSource.DISCOVERV2},
          dashboard: {
            ...testDashboard,
            widgets: [
              {
                title: 'Custom Measurement Widget',
                interval: '1d',
                id: '1',
                widgetType: WidgetType.DISCOVER,
                displayType: DisplayType.TABLE,
                queries: [
                  {
                    conditions: '',
                    name: '',
                    fields: [
                      'p99(measurements.custom.measurement)',
                      'transaction',
                      'count()',
                    ],
                    columns: ['transaction'],
                    aggregates: ['p99(measurements.custom.measurement)', 'count()'],
                    orderby: '-p99(measurements.custom.measurement)',
                  },
                ],
              },
            ],
          },
          params: {
            widgetIndex: '0',
          },
          orgFeatures: [...defaultOrgFeatures, 'discover-frontend-use-events-endpoint'],
        });
        expect(
          await screen.findByText('p99(measurements.custom.measurement)')
        ).toBeInTheDocument();
        // Delete p99(measurements.custom.measurement) column
        userEvent.click(screen.getAllByLabelText('Remove column')[0]);
        expect(
          screen.queryByText('p99(measurements.custom.measurement)')
        ).not.toBeInTheDocument();
        expect(screen.getAllByText('transaction').length).toEqual(1);
        expect(screen.getAllByText('count()').length).toEqual(2);
      });
    });
  });
});
