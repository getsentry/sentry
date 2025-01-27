import {urlEncode} from '@sentry/utils';
import {DashboardFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {MetricsFieldFixture} from 'sentry-fixture/metrics';
import {SessionsFieldFixture} from 'sentry-fixture/sessions';
import {TagsFixture} from 'sentry-fixture/tags';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import ProjectsStore from 'sentry/stores/projectsStore';
import TagStore from 'sentry/stores/tagStore';
import type {DashboardDetails, Widget} from 'sentry/views/dashboards/types';
import {
  DashboardWidgetSource,
  DisplayType,
  WidgetType,
} from 'sentry/views/dashboards/types';
import WidgetBuilder, {
  type WidgetBuilderProps,
} from 'sentry/views/dashboards/widgetBuilder';

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

  let eventsStatsMock: jest.Mock | undefined;
  let eventsMock: jest.Mock | undefined;

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

    eventsStatsMock = MockApiClient.addMockResponse({
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

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/sessions/',
      body: SessionsFieldFixture(`sum(session)`),
    });

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/metrics/data/',
      body: MetricsFieldFixture('session.all'),
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      method: 'GET',
      body: TagsFixture(),
    });

    MockApiClient.addMockResponse({
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
    jest.useRealTimers();
  });

  describe('with events > Sort by selectors', function () {
    it('renders', async function () {
      renderTestComponent();

      expect(await screen.findByText('Sort by a column')).toBeInTheDocument();
      expect(
        screen.getByText("Choose one of the columns you've created to sort by.")
      ).toBeInTheDocument();

      // Selector "sortDirection"
      expect(screen.getByText('High to low')).toBeInTheDocument();
      // Selector "sortBy"
      await waitFor(() => {
        expect(screen.getAllByText('count()')).toHaveLength(3);
      });
    });

    it('sortBy defaults to the first field value when changing display type to table', async function () {
      const widget: Widget = {
        id: '1',
        title: 'Errors over time',
        interval: '5m',
        displayType: DisplayType.LINE,
        queries: [
          {
            name: 'errors',
            conditions: 'event.type:error',
            fields: ['count()', 'count_unique(id)'],
            aggregates: ['count()', 'count_unique(id)'],
            columns: [],
            orderby: '',
          },
          {
            name: 'csp',
            conditions: 'event.type:csp',
            fields: ['count()', 'count_unique(id)'],
            aggregates: ['count()', 'count_unique(id)'],
            columns: [],
            orderby: '',
          },
        ],
      };

      const dashboard = mockDashboard({widgets: [widget]});

      renderTestComponent({
        dashboard,
        params: {
          widgetIndex: '0',
        },
      });

      // Click on the displayType selector
      await userEvent.click(await screen.findByText('Line Chart'));

      // Choose the table visualization
      await userEvent.click(screen.getByText('Table'));

      expect(await screen.findByText('Sort by a column')).toBeInTheDocument();

      // Selector "sortDirection"
      expect(screen.getByText('High to low')).toBeInTheDocument();

      // Selector "sortBy"
      expect(screen.getAllByText('count()')).toHaveLength(3);
    });

    it('can update selectors values', async function () {
      const handleSave = jest.fn();

      const widget: Widget = {
        id: '1',
        title: 'Errors over time',
        interval: '5m',
        displayType: DisplayType.TABLE,
        queries: [
          {
            name: '',
            conditions: '',
            fields: ['count()', 'count_unique(id)'],
            aggregates: ['count()', 'count_unique(id)'],
            columns: [],
            orderby: '-count()',
          },
        ],
      };

      const dashboard = mockDashboard({widgets: [widget]});

      renderTestComponent({
        dashboard,
        onSave: handleSave,
        params: {
          widgetIndex: '0',
        },
      });

      expect(await screen.findByText('Sort by a column')).toBeInTheDocument();

      // Selector "sortDirection"
      expect(screen.getByText('High to low')).toBeInTheDocument();

      // Selector "sortBy"
      expect(screen.getAllByText('count()')).toHaveLength(3);

      await selectEvent.select(screen.getAllByText('count()')[2]!, 'count_unique(id)');

      // Wait for the Builder update the widget values
      await waitFor(() => {
        expect(screen.getAllByText('count()')).toHaveLength(2);
      });

      // Now count_unique(id) is selected in the "sortBy" selector
      expect(screen.getAllByText('count_unique(id)')).toHaveLength(2);

      await selectEvent.select(screen.getByText('High to low'), 'Low to high');

      // Saves the widget
      await userEvent.click(screen.getByText('Update Widget'));

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith([
          expect.objectContaining({
            queries: [expect.objectContaining({orderby: 'count_unique(id)'})],
          }),
        ]);
      });
    });

    it('sortBy defaults to the first field value when coming from discover', async function () {
      const defaultWidgetQuery = {
        name: '',
        fields: ['title', 'count()', 'count_unique(user)', 'epm()', 'count()'],
        columns: ['title'],
        aggregates: ['count()', 'count_unique(user)', 'epm()', 'count()'],
        conditions: 'tag:value',
        orderby: '',
      };

      const {router} = renderTestComponent({
        query: {
          source: DashboardWidgetSource.DISCOVERV2,
          defaultWidgetQuery: urlEncode(defaultWidgetQuery),
          displayType: DisplayType.TABLE,
          defaultTableColumns: ['title', 'count()', 'count_unique(user)', 'epm()'],
        },
      });

      expect(await screen.findByText('Sort by a column')).toBeInTheDocument();

      // Selector "sortDirection"
      expect(await screen.findByText('Low to high')).toBeInTheDocument();

      // Selector "sortBy"
      await waitFor(() => {
        expect(screen.getAllByText('title')).toHaveLength(2);
      });

      // Saves the widget
      await userEvent.click(screen.getByText('Add Widget'));

      await waitFor(() => {
        expect(router.push).toHaveBeenCalledWith(
          expect.objectContaining({
            query: expect.objectContaining({queryOrderby: 'count()'}),
          })
        );
      });
    });

    it('sortBy is only visible on tabular visualizations or when there is a groupBy value selected on time-series visualizations', async function () {
      renderTestComponent();

      // Sort by shall be visible on table visualization
      expect(await screen.findByText('Sort by a column')).toBeInTheDocument();

      // Update visualization to be a time-series
      await userEvent.click(screen.getByText('Table'));
      await userEvent.click(screen.getByText('Line Chart'));

      // Time-series visualizations display GroupBy step
      expect(await screen.findByText('Group your results')).toBeInTheDocument();

      // Do not show sortBy when empty columns (groupBys) are added
      await userEvent.click(screen.getByText('Add Group'));
      expect(screen.getAllByText('Select group')).toHaveLength(2);

      // SortBy step shall not be visible
      expect(screen.queryByText('Sort by a y-axis')).not.toBeInTheDocument();

      // Select GroupBy value
      await selectEvent.select(screen.getAllByText('Select group')[0]!, 'project');

      // Now that at least one groupBy value is selected, the SortBy step shall be visible
      expect(screen.getByText('Sort by a y-axis')).toBeInTheDocument();

      // Remove selected GroupBy value
      await userEvent.click(screen.getAllByLabelText('Remove group')[0]!);

      // SortBy step shall no longer be visible
      expect(screen.queryByText('Sort by a y-axis')).not.toBeInTheDocument();
    });

    it('allows for sorting by a custom equation', async function () {
      renderTestComponent({
        query: {
          source: DashboardWidgetSource.DASHBOARDS,
          displayType: DisplayType.LINE,
        },
      });

      await selectEvent.select(await screen.findByText('Select group'), 'project');
      expect(screen.getAllByText('count()')).toHaveLength(2);
      await selectEvent.select(screen.getAllByText('count()')[1]!, 'Custom Equation');
      await userEvent.click(screen.getByPlaceholderText('Enter Equation'));
      await userEvent.paste('count_unique(user) * 2');
      await userEvent.keyboard('{Enter}');

      await waitFor(() => {
        expect(eventsStatsMock).toHaveBeenCalledWith(
          '/organizations/org-slug/events-stats/',
          expect.objectContaining({
            query: expect.objectContaining({
              field: expect.arrayContaining(['equation|count_unique(user) * 2']),
              orderby: '-equation[0]',
            }),
          })
        );
      });
    }, 10000);

    it('persists the state when toggling between sorting options', async function () {
      renderTestComponent({
        query: {
          source: DashboardWidgetSource.DASHBOARDS,
          displayType: DisplayType.LINE,
        },
      });

      await selectEvent.select(await screen.findByText('Select group'), 'project');
      expect(screen.getAllByText('count()')).toHaveLength(2);
      await selectEvent.select(screen.getAllByText('count()')[1]!, 'Custom Equation');
      await userEvent.click(screen.getByPlaceholderText('Enter Equation'));
      await userEvent.paste('count_unique(user) * 2');
      await userEvent.keyboard('{Enter}');

      // Switch away from the Custom Equation
      expect(screen.getByText('project')).toBeInTheDocument();
      await selectEvent.select(screen.getByText('Custom Equation'), 'project');
      expect(screen.getAllByText('project')).toHaveLength(2);

      // Switch back, the equation should still be visible
      await selectEvent.select(screen.getAllByText('project')[1]!, 'Custom Equation');
      expect(screen.getByPlaceholderText('Enter Equation')).toHaveValue(
        'count_unique(user) * 2'
      );
    });

    it('persists the state when updating y-axes', async function () {
      renderTestComponent({
        query: {
          source: DashboardWidgetSource.DASHBOARDS,
          displayType: DisplayType.LINE,
        },
      });

      await selectEvent.select(await screen.findByText('Select group'), 'project');
      expect(screen.getAllByText('count()')).toHaveLength(2);
      await selectEvent.select(screen.getAllByText('count()')[1]!, 'Custom Equation');
      await userEvent.click(screen.getByPlaceholderText('Enter Equation'));
      await userEvent.paste('count_unique(user) * 2');
      await userEvent.keyboard('{Enter}');

      // Add a y-axis
      await userEvent.click(screen.getByText('Add Series'));

      // The equation should still be visible
      expect(screen.getByPlaceholderText('Enter Equation')).toHaveValue(
        'count_unique(user) * 2'
      );
    });

    it('displays the custom equation if the widget has it saved', async function () {
      const widget: Widget = {
        id: '1',
        title: 'Test Widget',
        interval: '5m',
        displayType: DisplayType.LINE,
        queries: [
          {
            name: '',
            conditions: '',
            fields: ['count()', 'project'],
            aggregates: ['count()'],
            columns: ['project'],
            orderby: '-equation|count_unique(user) * 2',
          },
        ],
      };

      const dashboard = mockDashboard({widgets: [widget]});
      renderTestComponent({
        query: {
          source: DashboardWidgetSource.DASHBOARDS,
          displayType: DisplayType.LINE,
        },
        params: {
          widgetIndex: '0',
        },
        dashboard,
      });

      expect(await screen.findByPlaceholderText('Enter Equation')).toHaveValue(
        'count_unique(user) * 2'
      );
    });

    it('displays Operators in the input dropdown', async function () {
      renderTestComponent({
        query: {
          source: DashboardWidgetSource.DASHBOARDS,
          displayType: DisplayType.LINE,
        },
      });

      await selectEvent.select(await screen.findByText('Select group'), 'project');
      expect(screen.getAllByText('count()')).toHaveLength(2);
      await selectEvent.select(screen.getAllByText('count()')[1]!, 'Custom Equation');
      await selectEvent.openMenu(screen.getByPlaceholderText('Enter Equation'));

      await userEvent.click(screen.getByPlaceholderText('Enter Equation'));

      expect(screen.getByText('Operators')).toBeInTheDocument();
      expect(screen.queryByText('Fields')).not.toBeInTheDocument();
    });

    it('hides Custom Equation input and resets orderby when switching to table', async function () {
      renderTestComponent({
        query: {
          source: DashboardWidgetSource.DASHBOARDS,
          displayType: DisplayType.LINE,
        },
      });

      await selectEvent.select(await screen.findByText('Select group'), 'project');
      expect(screen.getAllByText('count()')).toHaveLength(2);
      await selectEvent.select(screen.getAllByText('count()')[1]!, 'Custom Equation');
      await userEvent.click(screen.getByPlaceholderText('Enter Equation'));
      await userEvent.paste('count_unique(user) * 2');
      await userEvent.keyboard('{Enter}');

      // Switch the display type to Table
      await userEvent.click(screen.getByText('Line Chart'));
      await userEvent.click(screen.getByText('Table'));

      expect(screen.getAllByText('count()')).toHaveLength(3);
      expect(screen.queryByPlaceholderText('Enter Equation')).not.toBeInTheDocument();

      await waitFor(() => {
        expect(eventsMock).toHaveBeenCalledWith(
          '/organizations/org-slug/events/',
          expect.objectContaining({
            query: expect.objectContaining({
              sort: ['-count()'],
            }),
          })
        );
      });
    });

    it('does not show the Custom Equation input if the only y-axis left is an empty equation', async function () {
      renderTestComponent({
        query: {
          source: DashboardWidgetSource.DASHBOARDS,
          displayType: DisplayType.LINE,
        },
      });

      await selectEvent.select(await screen.findByText('Select group'), 'project');
      await userEvent.click(screen.getByText('Add an Equation'));
      await userEvent.click(screen.getAllByLabelText('Remove this Y-Axis')[0]!);

      expect(screen.queryByPlaceholderText('Enter Equation')).not.toBeInTheDocument();
    });

    it('persists a sort by a grouping when changing y-axes', async function () {
      renderTestComponent({
        query: {
          source: DashboardWidgetSource.DASHBOARDS,
          displayType: DisplayType.LINE,
        },
      });

      await selectEvent.select(await screen.findByText('Select group'), 'project');
      expect(screen.getAllByText('count()')).toHaveLength(2);

      // Change the sort option to a grouping field, and then change a y-axis
      await selectEvent.select(screen.getAllByText('count()')[1]!, 'project');
      await selectEvent.select(screen.getAllByText('count()')[0]!, /count_unique/);

      // project should appear in the group by field, as well as the sort field
      expect(screen.getAllByText('project')).toHaveLength(2);
    });

    it('persists sort by a y-axis when grouping changes', async function () {
      renderTestComponent({
        query: {
          source: DashboardWidgetSource.DASHBOARDS,
          displayType: DisplayType.LINE,
        },
      });

      await userEvent.click(await screen.findByText('Add Series'));
      await selectEvent.select(screen.getByText('Select group'), 'project');

      // Change the sort by to count_unique
      await selectEvent.select(screen.getAllByText('count()')[1]!, /count_unique/);

      // Change the grouping
      await selectEvent.select(screen.getByText('project'), 'environment');

      // count_unique(user) should still be the sorting field
      expect(screen.getByText(/count_unique/)).toBeInTheDocument();
      expect(screen.getByText('user')).toBeInTheDocument();
    });

    it('does not remove the Custom Equation field if a grouping is updated', async function () {
      renderTestComponent({
        query: {
          source: DashboardWidgetSource.DASHBOARDS,
          displayType: DisplayType.LINE,
        },
      });

      await selectEvent.select(await screen.findByText('Select group'), 'project');
      await selectEvent.select(screen.getAllByText('count()')[1]!, 'Custom Equation');
      await userEvent.click(screen.getByPlaceholderText('Enter Equation'));
      await userEvent.paste('count_unique(user) * 2');
      await userEvent.keyboard('{Enter}');

      await userEvent.click(screen.getByText('Add Group'));
      expect(screen.getByPlaceholderText('Enter Equation')).toHaveValue(
        'count_unique(user) * 2'
      );
    });

    it.each`
      directionPrefix | expectedOrderSelection | displayType
      ${'-'}          | ${'High to low'}       | ${DisplayType.TABLE}
      ${''}           | ${'Low to high'}       | ${DisplayType.TABLE}
      ${'-'}          | ${'High to low'}       | ${DisplayType.LINE}
      ${''}           | ${'Low to high'}       | ${DisplayType.LINE}
    `(
      `opens a widget with the '$expectedOrderSelection' sort order when the widget was saved with that direction`,
      async function ({directionPrefix, expectedOrderSelection}) {
        const widget: Widget = {
          id: '1',
          title: 'Test Widget',
          interval: '5m',
          displayType: DisplayType.LINE,
          queries: [
            {
              name: '',
              conditions: '',
              fields: ['count_unique(user)'],
              aggregates: ['count_unique(user)'],
              columns: ['project'],
              orderby: `${directionPrefix}count_unique(user)`,
            },
          ],
        };

        const dashboard = mockDashboard({widgets: [widget]});

        renderTestComponent({
          dashboard,
          params: {
            widgetIndex: '0',
          },
        });

        await screen.findByText(expectedOrderSelection);
      }
    );

    it('saved widget with aggregate alias as orderby should persist alias when y-axes change', async function () {
      const widget: Widget = {
        id: '1',
        title: 'Test Widget',
        interval: '5m',
        displayType: DisplayType.TABLE,
        queries: [
          {
            name: '',
            conditions: '',
            fields: ['project', 'count_unique(user)'],
            aggregates: ['count_unique(user)'],
            columns: ['project'],
            orderby: 'count_unique(user)',
          },
        ],
      };

      const dashboard = mockDashboard({widgets: [widget]});

      renderTestComponent({
        dashboard,
        params: {
          widgetIndex: '0',
        },
      });

      await screen.findByText('Sort by a column');

      // Assert for length 2 since one in the table header and one in sort by
      expect(screen.getAllByText('count_unique(user)')).toHaveLength(2);

      await userEvent.click(screen.getByText('Add a Column'));

      // The sort by should still have count_unique(user)
      await waitFor(() =>
        expect(screen.getAllByText('count_unique(user)')).toHaveLength(2)
      );
    });

    it('will reset the sort field when going from line to table when sorting by a value not in fields', async function () {
      renderTestComponent({
        query: {
          displayType: DisplayType.LINE,
        },
      });

      await selectEvent.select(await screen.findByText('Select group'), 'project');
      expect(screen.getAllByText('count()')).toHaveLength(2);
      await selectEvent.select(screen.getAllByText('count()')[1]!, /count_unique/);

      await userEvent.click(screen.getByText('Line Chart'));
      await userEvent.click(screen.getByText('Table'));

      // 1 for table header, 1 for column selection, and 1 for sorting
      await waitFor(() => {
        expect(screen.getAllByText('count()')).toHaveLength(3);
      });
    });

    it('equations in y-axis appear in sort by field for grouped timeseries', async function () {
      renderTestComponent({
        query: {
          displayType: DisplayType.LINE,
        },
      });

      await userEvent.click(await screen.findByText('Add an Equation'));
      await userEvent.click(screen.getByPlaceholderText('Equation'));
      await userEvent.paste('count() * 100');
      await userEvent.keyboard('{Enter}');

      await selectEvent.select(screen.getByText('Select group'), 'project');
      expect(screen.getAllByText('count()')).toHaveLength(2);
      await selectEvent.select(screen.getAllByText('count()')[1]!, 'count() * 100');
    });

    it('does not reset the orderby when ordered by an equation in table', async function () {
      const widget: Widget = {
        id: '1',
        title: 'Errors over time',
        interval: '5m',
        displayType: DisplayType.TABLE,
        queries: [
          {
            name: '',
            conditions: '',
            fields: [
              'count()',
              'count_unique(id)',
              'equation|count() + count_unique(id)',
            ],
            aggregates: [
              'count()',
              'count_unique(id)',
              'equation|count() + count_unique(id)',
            ],
            columns: [],
            orderby: '-equation[0]',
          },
        ],
      };

      const dashboard = mockDashboard({widgets: [widget]});

      renderTestComponent({
        dashboard,
        params: {
          widgetIndex: '0',
        },
      });

      await screen.findByText('Sort by a column');

      // 1 in the column selector, 1 in the sort by field
      expect(screen.getAllByText('count() + count_unique(id)')).toHaveLength(2);
    });
  });

  it('ordering by column uses field form when selecting orderby', async function () {
    const widget: Widget = {
      id: '1',
      title: 'Test Widget',
      interval: '5m',
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'errors',
          conditions: 'event.type:error',
          fields: ['count()'],
          aggregates: ['count()'],
          columns: ['project'],
          orderby: '-project',
        },
      ],
    };

    const dashboard = mockDashboard({widgets: [widget]});

    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures],
      dashboard,
      params: {
        widgetIndex: '0',
      },
    });

    const projectElements = screen.getAllByText('project');
    await selectEvent.select(projectElements[projectElements.length - 1]!, 'count()');

    await waitFor(() => {
      expect(eventsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            sort: ['-count()'],
          }),
        })
      );
    });
  });

  it('hides Custom Equation input and resets orderby when switching to table', async function () {
    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures],
      query: {
        source: DashboardWidgetSource.DASHBOARDS,
        displayType: DisplayType.LINE,
      },
    });

    await selectEvent.select(await screen.findByText('Select group'), 'project');
    expect(screen.getAllByText('count()')).toHaveLength(2);
    await selectEvent.select(screen.getAllByText('count()')[1]!, 'Custom Equation');
    await userEvent.click(screen.getByPlaceholderText('Enter Equation'));
    await userEvent.paste('count_unique(user) * 2');
    await userEvent.keyboard('{Enter}');

    // Switch the display type to Table
    await userEvent.click(screen.getByText('Line Chart'));
    await userEvent.click(screen.getByText('Table'));

    expect(screen.getAllByText('count()')).toHaveLength(3);
    expect(screen.queryByPlaceholderText('Enter Equation')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(eventsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            sort: ['-count()'],
          }),
        })
      );
    });
  });

  describe('spans dataset timeseries', function () {
    it('returns group by and aggregate as primary options', async function () {
      const widget: Widget = {
        id: '1',
        title: 'Test Widget',
        interval: '5m',
        displayType: DisplayType.LINE,
        widgetType: WidgetType.SPANS,
        queries: [
          {
            name: '',
            conditions: '',
            fields: ['count(span.duration)', 'avg(span.duration)', 'transaction'],
            aggregates: ['count(span.duration)', 'avg(span.duration)'],
            columns: ['transaction'],
            orderby: '-count(span.duration)',
          },
        ],
      };

      const dashboard = mockDashboard({widgets: [widget]});

      renderTestComponent({
        dashboard,
        params: {
          widgetIndex: '0',
        },
        orgFeatures: [...defaultOrgFeatures, 'dashboards-eap'],
      });

      await screen.findByText('Sort by a y-axis');
      await selectEvent.openMenu(screen.getAllByText('count(\u2026)')[1]!);

      // 12 options in the dropdown
      expect(screen.queryAllByTestId('menu-list-item-label')).toHaveLength(12);

      // Appears once in the y-axis section, dropdown, and in the sort by field
      expect(await screen.findAllByText('count(\u2026)')).toHaveLength(3);

      // Appears once in the y-axis section and in the dropdown
      expect(await screen.findAllByText('avg(\u2026)')).toHaveLength(2);

      // Appears once in the dropdown and once in the group by field
      expect(await screen.findAllByText('transaction')).toHaveLength(2);
    });
  });
});
