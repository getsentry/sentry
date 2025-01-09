import {urlEncode} from '@sentry/utils';
import {DashboardFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {MetricsFieldFixture} from 'sentry-fixture/metrics';
import {SessionsFieldFixture} from 'sentry-fixture/sessions';
import {TagsFixture} from 'sentry-fixture/tags';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import ProjectsStore from 'sentry/stores/projectsStore';
import TagStore from 'sentry/stores/tagStore';
import {ERROR_FIELDS, ERRORS_AGGREGATION_FUNCTIONS} from 'sentry/utils/discover/fields';
import type {DashboardDetails, Widget} from 'sentry/views/dashboards/types';
import {
  DashboardWidgetSource,
  DisplayType,
  WidgetType,
} from 'sentry/views/dashboards/types';
import type {WidgetBuilderProps} from 'sentry/views/dashboards/widgetBuilder';
import WidgetBuilder from 'sentry/views/dashboards/widgetBuilder';

import WidgetLegendSelectionState from '../widgetLegendSelectionState';

const defaultOrgFeatures = [
  'performance-view',
  'dashboards-edit',
  'global-views',
  'dashboards-mep',
];

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
  const {organization, projects, router} = initializeOrg({
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

  ProjectsStore.loadInitialData(projects);

  const widgetLegendState = new WidgetLegendSelectionState({
    location: LocationFixture(),
    dashboard: DashboardFixture([], {id: 'new', title: 'Dashboard', ...dashboard}),
    organization,
    router,
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
      widgetLegendState={widgetLegendState}
    />,
    {
      router,
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
      url: '/organizations/org-slug/users/',
      body: [],
    });

    sessionsDataMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/sessions/',
      body: SessionsFieldFixture(`sum(session)`),
    });

    metricsDataMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/metrics/data/',
      body: MetricsFieldFixture('session.all'),
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      method: 'GET',
      body: TagsFixture(),
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

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/spans/fields/`,
      body: [],
    });

    TagStore.reset();
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    resetMockDate();
  });

  describe('Release Widgets', function () {
    it('shows the Release Health dataset', async function () {
      renderTestComponent();

      expect(await screen.findByText('Errors and Transactions')).toBeInTheDocument();
      expect(screen.getByText('Releases (Sessions, Crash rates)')).toBeInTheDocument();
    });

    it('maintains the selected dataset when display type is changed', async function () {
      renderTestComponent();

      expect(
        await screen.findByText('Releases (Sessions, Crash rates)')
      ).toBeInTheDocument();

      expect(screen.getByRole('radio', {name: /Releases/i})).not.toBeChecked();
      await userEvent.click(screen.getByRole('radio', {name: /Releases/i}));
      await waitFor(() =>
        expect(screen.getByRole('radio', {name: /Releases/i})).toBeChecked()
      );

      await userEvent.click(screen.getByText('Table'));
      await userEvent.click(screen.getByText('Line Chart'));
      await waitFor(() =>
        expect(screen.getByRole('radio', {name: /Releases/i})).toBeChecked()
      );
    });

    it('displays releases tags', async function () {
      renderTestComponent();

      expect(
        await screen.findByText('Releases (Sessions, Crash rates)')
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('radio', {name: /Releases/i}));

      expect(screen.getByText('crash_free_rate(…)')).toBeInTheDocument();
      expect(screen.getByText('session')).toBeInTheDocument();

      await userEvent.click(screen.getByText('crash_free_rate(…)'));
      expect(screen.getByText('count_unique(…)')).toBeInTheDocument();

      expect(screen.getByText('release')).toBeInTheDocument();
      expect(screen.getByText('environment')).toBeInTheDocument();
      expect(screen.getByText('session.status')).toBeInTheDocument();

      await userEvent.click(screen.getByText('count_unique(…)'));
      expect(screen.getByText('user')).toBeInTheDocument();
    });

    it('does not display tags as params', async function () {
      renderTestComponent();

      expect(
        await screen.findByText('Releases (Sessions, Crash rates)')
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('radio', {name: /Releases/i}));

      expect(screen.getByText('crash_free_rate(…)')).toBeInTheDocument();
      await selectEvent.select(screen.getByText('crash_free_rate(…)'), 'count_unique(…)');

      await userEvent.click(screen.getByText('user'));
      expect(screen.queryByText('release')).not.toBeInTheDocument();
      expect(screen.queryByText('environment')).not.toBeInTheDocument();
      expect(screen.queryByText('session.status')).not.toBeInTheDocument();
    });

    it('does not allow sort by when session.status is selected', async function () {
      renderTestComponent();

      expect(
        await screen.findByText('Releases (Sessions, Crash rates)')
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('radio', {name: /Releases/i}));

      expect(screen.getByText('High to low')).toBeEnabled();
      expect(screen.getByText('crash_free_rate(session)')).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Add a Column'));
      await selectEvent.select(screen.getByText('(Required)'), 'session.status');

      expect(screen.getByRole('textbox', {name: 'Sort direction'})).toBeDisabled();
      expect(screen.getByRole('textbox', {name: 'Sort by'})).toBeDisabled();
    });

    it('does not allow sort on tags except release', async function () {
      setMockDate(new Date('2022-08-02'));
      renderTestComponent();

      expect(
        await screen.findByText('Releases (Sessions, Crash rates)')
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('radio', {name: /Releases/i}), {
        delay: null,
      });

      expect(
        within(screen.getByTestId('sort-by-step')).getByText('High to low')
      ).toBeEnabled();
      expect(
        within(screen.getByTestId('sort-by-step')).getByText('crash_free_rate(session)')
      ).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Add a Column'), {delay: null});
      await selectEvent.select(screen.getByText('(Required)'), 'release');

      await userEvent.click(screen.getByLabelText('Add a Column'), {delay: null});
      await selectEvent.select(screen.getByText('(Required)'), 'environment');

      expect(await screen.findByText('Sort by a column')).toBeInTheDocument();

      // Selector "sortDirection"
      expect(screen.getByText('High to low')).toBeInTheDocument();

      // Selector "sortBy"
      await userEvent.click(screen.getAllByText('crash_free_rate(session)')[1]!, {
        delay: null,
      });

      // release exists in sort by selector
      expect(screen.getAllByText('release')).toHaveLength(3);
      // environment does not exist in sort by selector
      expect(screen.getAllByText('environment')).toHaveLength(2);
    });

    it('makes the appropriate sessions call', async function () {
      setMockDate(new Date('2022-08-02'));
      renderTestComponent();

      expect(
        await screen.findByText('Releases (Sessions, Crash rates)')
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('radio', {name: /Releases/i}), {
        delay: null,
      });

      await userEvent.click(screen.getByText('Table'), {delay: null});
      await userEvent.click(screen.getByText('Line Chart'), {delay: null});

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
      setMockDate(new Date('2022-08-02'));
      renderTestComponent();

      expect(
        await screen.findByText('Releases (Sessions, Crash rates)')
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('radio', {name: /Releases/i}), {
        delay: null,
      });

      await userEvent.click(screen.getByText('Table'), {delay: null});
      await userEvent.click(screen.getByText('Line Chart'), {delay: null});

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
      setMockDate(new Date('2022-08-02'));
      renderTestComponent();

      expect(
        await screen.findByText('Releases (Sessions, Crash rates)')
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('radio', {name: /Releases/i}), {
        delay: null,
      });

      await userEvent.click(screen.getByText('Table'), {delay: null});
      await userEvent.click(screen.getByText('Line Chart'), {delay: null});

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
      renderTestComponent();

      expect(
        await screen.findByText('Releases (Sessions, Crash rates)')
      ).toBeInTheDocument();

      // change dataset to releases
      await userEvent.click(screen.getByRole('radio', {name: /Releases/i}));

      await userEvent.click(screen.getByText('Table'));
      await userEvent.click(screen.getByText('Line Chart'));

      expect(screen.getByText('crash_free_rate(…)')).toBeInTheDocument();
      expect(screen.getByText(`session`)).toBeInTheDocument();

      await userEvent.click(screen.getByText('crash_free_rate(…)'));
      expect(screen.getByText('count_unique(…)')).toBeInTheDocument();

      await userEvent.click(screen.getByText('count_unique(…)'));
      expect(screen.getByText('user')).toBeInTheDocument();
    });

    it('sets widgetType to release', async function () {
      setMockDate(new Date('2022-08-02'));
      renderTestComponent();

      await userEvent.click(await screen.findByText('Releases (Sessions, Crash rates)'), {
        delay: null,
      });

      expect(metricsDataMock).toHaveBeenCalled();
      expect(screen.getByRole('radio', {name: /Releases/i})).toBeChecked();
    });

    it('does not display "add an equation" button', async function () {
      const widget: Widget = {
        title: 'Release Widget',
        displayType: DisplayType.TABLE,
        widgetType: WidgetType.RELEASE,
        queries: [
          {
            name: 'errors',
            conditions: '',
            fields: ['session.crash_free_rate'],
            columns: ['scount_abnormal(session)'],
            aggregates: ['session.crash_free_rate'],
            orderby: '-session.crash_free_rate',
          },
        ],
        interval: '1d',
        id: '1',
      };

      const dashboard = mockDashboard({widgets: [widget]});

      renderTestComponent({
        dashboard,
        params: {
          widgetIndex: '0',
        },
      });

      // Select line chart display
      await userEvent.click(await screen.findByText('Table'));
      await userEvent.click(screen.getByText('Line Chart'));

      await waitFor(() =>
        expect(screen.queryByLabelText('Add an Equation')).not.toBeInTheDocument()
      );
    });

    it('suggests release properties for sessions dataset', async function () {
      renderTestComponent();

      await userEvent.click(
        await screen.findByRole('combobox', {name: 'Add a search term'})
      );
      await userEvent.paste('session.status:');

      const row = await screen.findByRole('row', {name: 'session.status:'});
      expect(row).toHaveAttribute('aria-invalid', 'true');

      await userEvent.click(
        screen.getByRole('button', {name: 'Remove filter: session.status'})
      );

      await userEvent.click(screen.getByText('Releases (Sessions, Crash rates)'));

      await userEvent.click(
        await screen.findByRole('combobox', {name: 'Add a search term'})
      );

      expect(await screen.findByRole('button', {name: 'All'})).toBeInTheDocument();

      const menu = screen.getByRole('listbox');
      const groups = within(menu).getAllByRole('group');

      const all = groups[0]!;
      expect(within(all).getByRole('option', {name: 'environment'})).toBeInTheDocument();
      expect(within(all).getByRole('option', {name: 'project'})).toBeInTheDocument();
      expect(within(all).getByRole('option', {name: 'release'})).toBeInTheDocument();
    });

    it('adds a function when the only column chosen in a table is a tag', async function () {
      setMockDate(new Date('2022-08-02'));
      renderTestComponent();

      await userEvent.click(await screen.findByText('Releases (Sessions, Crash rates)'), {
        delay: null,
      });

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

      await userEvent.click(
        await screen.findByText('Issues (States, Assignment, Time, etc.)')
      );
      await userEvent.click(screen.getByLabelText('Add Widget'));

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

      await userEvent.click(await screen.findByText('Table'));
      await userEvent.click(screen.getByText('Line Chart'));
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

    it('renders errors and transactions dataset options', async function () {
      renderTestComponent({
        query: {
          source: DashboardWidgetSource.DISCOVERV2,
        },
        orgFeatures: [...defaultOrgFeatures, 'performance-discover-dataset-selector'],
      });

      await userEvent.click(await screen.findByText('Table'));
      await userEvent.click(screen.getByText('Line Chart'));
      expect(
        screen.getByRole('radio', {
          name: 'Errors (TypeError, InvalidSearchQuery, etc)',
        })
      ).toBeEnabled();
      expect(
        screen.getByRole('radio', {
          name: 'Transactions',
        })
      ).toBeEnabled();
    });

    it('disables moving and deleting issue column', async function () {
      renderTestComponent();

      await userEvent.click(
        await screen.findByText('Issues (States, Assignment, Time, etc.)')
      );
      expect(
        within(screen.getByTestId('choose-column-step')).getByText('issue')
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId('choose-column-step')).getByText('assignee')
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId('choose-column-step')).getByText('title')
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId('choose-column-step')).getAllByLabelText(
          'Remove column'
        )
      ).toHaveLength(2);
      expect(
        within(screen.getByTestId('choose-column-step')).getAllByLabelText(
          'Drag to reorder'
        )
      ).toHaveLength(3);

      await userEvent.click(screen.getAllByLabelText('Remove column')[1]!);
      await userEvent.click(screen.getAllByLabelText('Remove column')[0]!);

      expect(
        within(screen.getByTestId('choose-column-step')).getByText('issue')
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId('choose-column-step')).queryByText('assignee')
      ).not.toBeInTheDocument();
      expect(
        within(screen.getByTestId('choose-column-step')).queryByText('title')
      ).not.toBeInTheDocument();
      expect(
        within(screen.getByTestId('choose-column-step')).queryByLabelText('Remove column')
      ).not.toBeInTheDocument();
      expect(
        within(screen.getByTestId('choose-column-step')).queryByLabelText(
          'Drag to reorder'
        )
      ).not.toBeInTheDocument();
    });

    it('does not suggest issue filter keys for default dataset', async function () {
      renderTestComponent();

      await userEvent.click(
        await screen.findByRole('combobox', {name: 'Add a search term'})
      );
      await userEvent.paste('bookmarks');

      expect(
        await screen.findByRole('option', {
          name: '"bookmarks"',
        })
      ).toBeInTheDocument();
    });

    it('suggests issue filter keys for issues dataset', async function () {
      renderTestComponent();

      await userEvent.click(
        await screen.findByText('Issues (States, Assignment, Time, etc.)')
      );

      await userEvent.click(
        await screen.findByRole('combobox', {name: 'Add a search term'})
      );
      await userEvent.paste('ass');

      expect(screen.getByLabelText('assigned')).toBeInTheDocument();
    });

    it('Update table header values (field alias)', async function () {
      const handleSave = jest.fn();

      renderTestComponent({
        onSave: handleSave,
      });

      await screen.findByText('Table');

      await userEvent.click(screen.getByText('Issues (States, Assignment, Time, etc.)'));

      await userEvent.type(screen.getAllByPlaceholderText('Alias')[0]!, 'First Alias');

      await userEvent.click(screen.getByText('Add Widget'));

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
          orgFeatures: [...defaultOrgFeatures],
        });

        expect(await screen.findByText('Custom Widget')).toBeInTheDocument();

        // 1 in the table header, 1 in the column selector, 1 in the sort field
        const countFields = screen.getAllByText('count()');
        expect(countFields).toHaveLength(3);

        await selectEvent.select(countFields[1]!, ['p99(…)']);
        await selectEvent.select(screen.getByText('transaction.duration'), [
          'measurements.custom.measurement',
        ]);

        await userEvent.click(screen.getByText('Add Widget'));

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
                widgetType: 'discover',
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
            'dashboards-mep',
            'dynamic-sampling',
            'mep-rollout-flag',
          ],
        });

        await waitFor(() => {
          expect(measurementsMetaMock).toHaveBeenCalled();
        });

        await waitFor(() => {
          expect(eventsMock).toHaveBeenCalled();
        });

        screen.getByText('Your selection is only applicable to', {exact: false});
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
            'dashboards-mep',
            'dynamic-sampling',
            'mep-rollout-flag',
          ],
        });

        await waitFor(() => {
          expect(measurementsMetaMock).toHaveBeenCalled();
        });

        await waitFor(() => {
          expect(eventsMock).toHaveBeenCalled();
        });

        screen.getByText('Your selection is only applicable to', {exact: false});
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
          orgFeatures: [...defaultOrgFeatures, 'dashboards-mep'],
        });

        await waitFor(() => {
          expect(measurementsMetaMock).toHaveBeenCalled();
        });

        await waitFor(() => {
          expect(eventsMock).toHaveBeenCalled();
        });

        expect(
          screen.queryByText('Your selection is only applicable to', {exact: false})
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
          orgFeatures: [...defaultOrgFeatures],
        });

        expect(await screen.findByText('Custom Widget')).toBeInTheDocument();

        await selectEvent.select(screen.getAllByText('count()')[1]!, ['p99(…)']);
        await userEvent.click(screen.getByText('transaction.duration'));
        screen.getByText('measurements.custom.measurement');
        expect(
          screen.queryByText('measurements.another.custom.measurement')
        ).not.toBeInTheDocument();
        await selectEvent.select(screen.getAllByText('p99(…)')[0]!, ['p95(…)']);
        await userEvent.click(screen.getByText('transaction.duration'));
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
          orgFeatures: [...defaultOrgFeatures],
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
          orgFeatures: [...defaultOrgFeatures],
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
          orgFeatures: [...defaultOrgFeatures],
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
          orgFeatures: [...defaultOrgFeatures],
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
          orgFeatures: [...defaultOrgFeatures],
        });
        await screen.findByText('transaction');
        await userEvent.click(screen.getAllByText('count()')[1]!);
        expect(
          await screen.findByText('measurements.custom.measurement')
        ).toBeInTheDocument();
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
          orgFeatures: [...defaultOrgFeatures],
        });
        expect(
          await screen.findByText('p99(measurements.custom.measurement)')
        ).toBeInTheDocument();
        // Delete p99(measurements.custom.measurement) column
        await userEvent.click(screen.getAllByLabelText('Remove column')[0]!);
        expect(
          screen.queryByText('p99(measurements.custom.measurement)')
        ).not.toBeInTheDocument();
        expect(
          within(screen.getByTestId('sort-by-step')).queryByText('transaction')
        ).not.toBeInTheDocument();
        expect(
          within(screen.getByTestId('sort-by-step')).getByText('count()')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Errors dataset', function () {
    it('only shows the correct aggregates for timeseries charts', async function () {
      renderTestComponent({
        dashboard: {
          ...testDashboard,
          widgets: [
            {
              title: 'Errors Widget',
              interval: '1d',
              id: '1',
              widgetType: WidgetType.ERRORS,
              displayType: DisplayType.LINE,
              queries: [
                {
                  conditions: '',
                  name: '',
                  fields: ['count()'],
                  columns: [],
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
        orgFeatures: [...defaultOrgFeatures, 'performance-discover-dataset-selector'],
      });

      // Open the y-axis options dropdown
      const yAxisStep = screen
        .getByRole('heading', {name: /choose what to plot in the y-axis/i})
        .closest('li');
      await userEvent.click(within(yAxisStep!).getByText('count()'));

      // Verify the error aggregates are present
      expect(screen.getAllByRole('menuitemradio')).toHaveLength(
        ERRORS_AGGREGATION_FUNCTIONS.length
      );
      ERRORS_AGGREGATION_FUNCTIONS.forEach(aggregation => {
        expect(
          screen.getByRole('menuitemradio', {name: new RegExp(`${aggregation}\\(…?\\)`)})
        ).toBeInTheDocument();
      });
    });

    it('only shows the correct aggregate params for timeseries charts', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/',
        method: 'GET',
        body: [],
      });
      renderTestComponent({
        dashboard: {
          ...testDashboard,
          widgets: [
            {
              title: 'Errors Widget',
              interval: '1d',
              id: '1',
              widgetType: WidgetType.ERRORS,
              displayType: DisplayType.LINE,
              queries: [
                {
                  conditions: '',
                  name: '',
                  fields: ['count_unique(user)'],
                  columns: [],
                  aggregates: ['count_unique(user)'],
                  orderby: '-count_unique(user)',
                },
              ],
            },
          ],
        },
        params: {
          widgetIndex: '0',
        },
        orgFeatures: [...defaultOrgFeatures, 'performance-discover-dataset-selector'],
      });

      expect(await screen.findByText('Select group')).toBeInTheDocument();

      // Open the aggregate parameter dropdown
      const yAxisStep = screen
        .getByRole('heading', {name: /choose what to plot in the y-axis/i})
        .closest('li');
      await userEvent.click(within(yAxisStep!).getByText('user'));

      // Verify the error aggregate params are present
      expect(screen.getAllByTestId('menu-list-item-label')).toHaveLength(
        ERROR_FIELDS.length
      );
      ERROR_FIELDS.forEach(field => {
        expect(screen.getByRole('menuitemradio', {name: field})).toBeInTheDocument();
      });
    });
  });
});
