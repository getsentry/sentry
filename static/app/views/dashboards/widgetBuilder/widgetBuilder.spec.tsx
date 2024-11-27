import {urlEncode} from '@sentry/utils';
import {DashboardFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {MetricsFieldFixture} from 'sentry-fixture/metrics';
import {ReleaseFixture} from 'sentry-fixture/release';
import {SessionsFieldFixture} from 'sentry-fixture/sessions';
import {TagsFixture} from 'sentry-fixture/tags';
import {WidgetFixture} from 'sentry-fixture/widget';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import * as modals from 'sentry/actionCreators/modal';
import ProjectsStore from 'sentry/stores/projectsStore';
import TagStore from 'sentry/stores/tagStore';
import {DatasetSource, TOP_N} from 'sentry/utils/discover/types';
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
  updateDashboardSplitDecision,
}: {
  dashboard?: WidgetBuilderProps['dashboard'];
  onSave?: WidgetBuilderProps['onSave'];
  orgFeatures?: string[];
  params?: Partial<WidgetBuilderProps['params']>;
  query?: Record<string, any>;
  updateDashboardSplitDecision?: WidgetBuilderProps['updateDashboardSplitDecision'];
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
      updateDashboardSplitDecision={updateDashboardSplitDecision}
      widgetLegendState={widgetLegendState}
    />,
    {
      router,
      organization,
    }
  );

  return {router};
}

/**
 * This test suite contains tests that test the generic interactions
 * between most components in the WidgetBuilder. Tests for the
 * SortBy step can be found in (and should be added to)
 * ./widgetBuilderSortBy.spec.tsx and tests for specific dataset
 * behaviour can be found (and should be added to) ./widgetBuilderDataset.spec.tsx.
 * The test files are broken up to allow better parallelization
 * in CI (we currently parallelize files).
 */
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
  let tagsMock: jest.Mock | undefined;

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

    tagsMock = MockApiClient.addMockResponse({
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
      url: '/organizations/org-slug/tags/transaction.duration/values/',
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
  });

  it('no feature access', function () {
    renderTestComponent({orgFeatures: []});

    expect(screen.getByText("You don't have access to this feature")).toBeInTheDocument();
  });

  it('widget not found', async function () {
    const widget: Widget = {
      displayType: DisplayType.AREA,
      interval: '1d',
      queries: [
        {
          name: 'Known Users',
          fields: [],
          columns: [],
          aggregates: [],
          conditions: '',
          orderby: '-time',
        },
        {
          name: 'Anonymous Users',
          fields: [],
          columns: [],
          aggregates: [],
          conditions: '',
          orderby: '-time',
        },
      ],
      title: 'Transactions',
      id: '1',
    };

    const dashboard = mockDashboard({widgets: [widget]});

    renderTestComponent({
      dashboard,
      orgFeatures: ['dashboards-edit'],
      params: {
        widgetIndex: '2', // Out of bounds, only one widget
      },
    });

    expect(
      await screen.findByText('The widget you want to edit was not found.')
    ).toBeInTheDocument();
  });

  it('renders a widget not found message if the widget index url is not an integer', async function () {
    const widget: Widget = {
      displayType: DisplayType.AREA,
      interval: '1d',
      queries: [
        {
          name: 'Known Users',
          fields: [],
          columns: [],
          aggregates: [],
          conditions: '',
          orderby: '-time',
        },
      ],
      title: 'Transactions',
      id: '1',
    };

    const dashboard = mockDashboard({widgets: [widget]});

    renderTestComponent({
      dashboard,
      orgFeatures: ['dashboards-edit'],
      params: {
        widgetIndex: '0.5', // Invalid index
      },
    });

    expect(
      await screen.findByText('The widget you want to edit was not found.')
    ).toBeInTheDocument();
  });

  it('renders', async function () {
    renderTestComponent();

    // Header - Breadcrumbs
    expect(await screen.findByRole('link', {name: 'Dashboards'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboards/'
    );
    expect(screen.getByRole('link', {name: 'Dashboard'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboards/new/'
    );
    expect(screen.getByText('Widget Builder')).toBeInTheDocument();

    // Header - Widget Title
    expect(screen.getByText('Custom Widget')).toBeInTheDocument();

    // Footer - Actions
    expect(screen.getByLabelText('Cancel')).toBeInTheDocument();
    expect(screen.getByLabelText('Add Widget')).toBeInTheDocument();

    // Content - Step 1
    expect(
      screen.getByRole('heading', {name: 'Choose your dataset'})
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Errors and Transactions')).toBeChecked();

    // Content - Step 2
    expect(
      screen.getByRole('heading', {name: 'Choose your visualization'})
    ).toBeInTheDocument();

    // Content - Step 3
    expect(
      screen.getByRole('heading', {name: 'Choose your columns'})
    ).toBeInTheDocument();

    // Content - Step 4
    expect(
      screen.getByRole('heading', {name: 'Filter your results'})
    ).toBeInTheDocument();

    // Content - Step 5
    expect(screen.getByRole('heading', {name: 'Sort by a column'})).toBeInTheDocument();
  });

  it('has links back to the new dashboard if creating', async function () {
    // Dashboard has undefined dashboardId when creating from a new dashboard
    // because of route setup
    renderTestComponent({params: {dashboardId: undefined}});

    expect(await screen.findByLabelText('Cancel')).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboards/new/'
    );
  });

  it('renders new design', async function () {
    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures],
    });

    // Switch to line chart for time series
    await userEvent.click(screen.getByText('Table'));
    await userEvent.click(screen.getByText('Line Chart'));

    // Header - Breadcrumbs
    expect(await screen.findByRole('link', {name: 'Dashboards'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboards/'
    );

    expect(screen.getByRole('link', {name: 'Dashboard'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboards/new/'
    );

    expect(screen.getByText('Widget Builder')).toBeInTheDocument();

    // Header - Widget Title
    expect(screen.getByText('Custom Widget')).toBeInTheDocument();

    // Footer - Actions
    expect(screen.getByLabelText('Cancel')).toBeInTheDocument();
    expect(screen.getByLabelText('Add Widget')).toBeInTheDocument();

    // Content - Step 1
    expect(
      screen.getByRole('heading', {name: 'Choose your dataset'})
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Errors and Transactions')).toBeChecked();

    // Content - Step 2
    expect(
      screen.getByRole('heading', {name: 'Choose your visualization'})
    ).toBeInTheDocument();

    // Content - Step 3
    expect(
      screen.getByRole('heading', {name: 'Choose what to plot in the y-axis'})
    ).toBeInTheDocument();

    // Content - Step 4
    expect(
      screen.getByRole('heading', {name: 'Filter your results'})
    ).toBeInTheDocument();

    // Content - Step 5
    expect(screen.getByRole('heading', {name: 'Group your results'})).toBeInTheDocument();
  });

  it('can update the title', async function () {
    renderTestComponent({
      query: {source: DashboardWidgetSource.DISCOVERV2},
    });

    const customWidgetLabels = await screen.findByText('Custom Widget');
    // EditableText and chart title
    expect(customWidgetLabels).toBeInTheDocument();

    await userEvent.clear(screen.getByRole('textbox', {name: 'Widget title'}));
    await userEvent.click(screen.getByRole('textbox', {name: 'Widget title'}));
    await userEvent.paste('Unique Users');
    await userEvent.keyboard('{enter}');

    expect(screen.queryByText('Custom Widget')).not.toBeInTheDocument();

    expect(screen.getByText('Unique Users')).toBeInTheDocument();
  });

  it('can add query conditions', async function () {
    const {router} = renderTestComponent({
      query: {source: DashboardWidgetSource.DISCOVERV2},
      dashboard: testDashboard,
    });

    await userEvent.click(
      await screen.findByRole('combobox', {name: 'Add a search term'})
    );
    await userEvent.paste('color:blue');
    await userEvent.keyboard('{enter}');

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
            queryConditions: ['color:blue'],
            queryFields: ['count()'],
            queryOrderby: '-count()',
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

  it('can choose a field', async function () {
    const {router} = renderTestComponent({
      query: {source: DashboardWidgetSource.DISCOVERV2},
      dashboard: testDashboard,
    });

    expect(await screen.findByText('Custom Widget')).toBeInTheDocument();

    // No delete button as there is only one query.
    expect(screen.queryByLabelText('Remove query')).not.toBeInTheDocument();

    // 1 in the table header, 1 in the column selector, 1 in the sort field
    const countFields = screen.getAllByText('count()');
    expect(countFields).toHaveLength(3);

    await selectEvent.select(countFields[1], ['last_seen()']);

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
            queryFields: ['last_seen()'],
            queryOrderby: '-last_seen()',
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

  it('can add additional fields', async function () {
    const handleSave = jest.fn();

    renderTestComponent({onSave: handleSave});

    await userEvent.click(await screen.findByText('Table'));

    // Select line chart display
    await userEvent.click(screen.getByText('Line Chart'));

    // Click the Add Series button
    await userEvent.click(screen.getByLabelText('Add Series'));
    await selectEvent.select(screen.getByText('(Required)'), ['count_unique(…)']);

    await userEvent.click(screen.getByLabelText('Add Widget'));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith([
        expect.objectContaining({
          title: 'Custom Widget',
          displayType: DisplayType.LINE,
          interval: '5m',
          widgetType: WidgetType.DISCOVER,
          queries: [
            {
              conditions: '',
              fields: ['count()', 'count_unique(user)'],
              aggregates: ['count()', 'count_unique(user)'],
              fieldAliases: [],
              columns: [],
              orderby: '',
              name: '',
            },
          ],
        }),
      ]);
    });

    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('can add additional fields and equation for Big Number with selection', async function () {
    renderTestComponent({
      query: {
        displayType: DisplayType.BIG_NUMBER,
      },
      orgFeatures: [...defaultOrgFeatures, 'dashboards-bignumber-equations'],
    });

    // Add new field
    await userEvent.click(screen.getByLabelText('Add Field'));
    expect(screen.getByText('(Required)')).toBeInTheDocument();
    await selectEvent.select(screen.getByText('(Required)'), ['count_unique(…)']);
    expect(screen.getByRole('radio', {name: 'field1'})).toBeChecked();

    // Add another new field
    await userEvent.click(screen.getByLabelText('Add Field'));
    expect(screen.getByText('(Required)')).toBeInTheDocument();
    await selectEvent.select(screen.getByText('(Required)'), ['eps()']);
    expect(screen.getByRole('radio', {name: 'field2'})).toBeChecked();

    // Add an equation
    await userEvent.click(screen.getByLabelText('Add an Equation'));
    expect(screen.getByPlaceholderText('Equation')).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'field3'})).toBeChecked();
    await userEvent.click(screen.getByPlaceholderText('Equation'));
    await userEvent.paste('eps() + 100');

    // Check if right value is displayed from equation
    await userEvent.click(screen.getByPlaceholderText('Equation'));
    await userEvent.paste('2 * 100');
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('can add equation fields', async function () {
    const handleSave = jest.fn();

    renderTestComponent({onSave: handleSave});
    await userEvent.click(await screen.findByText('Table'));

    // Select line chart display
    await userEvent.click(screen.getByText('Line Chart'));

    // Click the add an equation button
    await userEvent.click(screen.getByLabelText('Add an Equation'));

    expect(screen.getByPlaceholderText('Equation')).toBeInTheDocument();

    await userEvent.click(screen.getByPlaceholderText('Equation'));
    await userEvent.paste('count() + 100');

    await userEvent.click(screen.getByLabelText('Add Widget'));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith([
        expect.objectContaining({
          title: 'Custom Widget',
          displayType: DisplayType.LINE,
          interval: '5m',
          widgetType: WidgetType.DISCOVER,
          queries: [
            {
              name: '',
              fields: ['count()', 'equation|count() + 100'],
              aggregates: ['count()', 'equation|count() + 100'],
              columns: [],
              fieldAliases: [],
              conditions: '',
              orderby: '',
            },
          ],
        }),
      ]);
    });

    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('can respond to validation feedback', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/widgets/',
      method: 'POST',
      statusCode: 400,
      body: {
        title: ['This field may not be blank.'],
      },
    });

    renderTestComponent();

    await userEvent.click(await screen.findByText('Table'));

    const customWidgetLabels = await screen.findByText('Custom Widget');
    // EditableText and chart title
    expect(customWidgetLabels).toBeInTheDocument();

    await userEvent.clear(screen.getByRole('textbox', {name: 'Widget title'}));

    await userEvent.click(screen.getByText('Add Widget'));

    await screen.findByText('This field may not be blank.');
  });

  it('sets up widget data in edit correctly', async function () {
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

    renderTestComponent({dashboard, params: {widgetIndex: '0'}});

    await screen.findByText('Line Chart');

    // Should be in edit 'mode'
    expect(await screen.findByText('Update Widget')).toBeInTheDocument();

    // Should set widget data up.
    expect(screen.getByText('Update Widget')).toBeInTheDocument();

    // Filters
    expect(
      await screen.findAllByRole('grid', {name: 'Create a search query'})
    ).toHaveLength(2);
    expect(screen.getByRole('row', {name: 'event.type:csp'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'event.type:error'})).toBeInTheDocument();

    // Y-axis
    expect(screen.getAllByRole('button', {name: 'Remove query'})).toHaveLength(2);
    expect(screen.getByText('count()')).toBeInTheDocument();
    expect(screen.getByText('count_unique(…)')).toBeInTheDocument();
    expect(screen.getByText('id')).toBeInTheDocument();

    // Expect events-stats endpoint to be called for each search conditions with
    // the same y-axis parameters
    expect(eventsStatsMock).toHaveBeenNthCalledWith(
      1,
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'event.type:error',
          yAxis: ['count()', 'count_unique(id)'],
        }),
      })
    );

    expect(eventsStatsMock).toHaveBeenNthCalledWith(
      2,
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'event.type:csp',
          yAxis: ['count()', 'count_unique(id)'],
        }),
      })
    );
  });

  it('can edit a widget', async function () {
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

    const handleSave = jest.fn();

    renderTestComponent({onSave: handleSave, dashboard, params: {widgetIndex: '0'}});

    await screen.findByText('Line Chart');

    // Should be in edit 'mode'
    expect(screen.getByText('Update Widget')).toBeInTheDocument();

    const customWidgetLabels = screen.getByText(widget.title);
    // EditableText and chart title
    expect(customWidgetLabels).toBeInTheDocument();

    await userEvent.clear(screen.getByRole('textbox', {name: 'Widget title'}));
    await userEvent.click(screen.getByRole('textbox', {name: 'Widget title'}));
    await userEvent.paste('New Title');

    await userEvent.click(screen.getByRole('button', {name: 'Update Widget'}));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith([
        expect.objectContaining({
          ...widget,
          title: 'New Title',
        }),
      ]);
    });

    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('renders column inputs for table widgets', async function () {
    const widget: Widget = {
      id: '0',
      title: 'sdk usage',
      interval: '5m',
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'errors',
          conditions: 'event.type:error',
          fields: ['sdk.name', 'count()'],
          columns: ['sdk.name'],
          aggregates: ['count()'],
          orderby: '',
        },
      ],
    };

    const dashboard = mockDashboard({widgets: [widget]});

    renderTestComponent({dashboard, params: {widgetIndex: '0'}});

    // Should be in edit 'mode'
    expect(await screen.findByText('Update Widget')).toBeInTheDocument();

    // Should set widget data up.
    expect(screen.getByText(widget.title)).toBeInTheDocument();
    expect(screen.getByText('Table')).toBeInTheDocument();
    await screen.findByRole('grid', {name: 'Create a search query'});

    // Should have an orderby select
    expect(screen.getByText('Sort by a column')).toBeInTheDocument();

    // Add a column, and choose a value,
    expect(screen.getByLabelText('Add a Column')).toBeInTheDocument();
  });

  it('can save table widgets', async function () {
    const widget: Widget = {
      id: '0',
      title: 'sdk usage',
      interval: '5m',
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'errors',
          conditions: 'event.type:error',
          fields: ['sdk.name', 'count()'],
          columns: ['sdk.name'],
          aggregates: ['count()'],
          orderby: '-count()',
        },
      ],
    };

    const dashboard = mockDashboard({widgets: [widget]});

    const handleSave = jest.fn();

    renderTestComponent({dashboard, onSave: handleSave, params: {widgetIndex: '0'}});

    // Should be in edit 'mode'
    expect(await screen.findByText('Update Widget')).toBeInTheDocument();
    // Add a column, and choose a value,
    await userEvent.click(screen.getByLabelText('Add a Column'));
    await selectEvent.select(screen.getByText('(Required)'), 'trace');

    // Save widget
    await userEvent.click(screen.getByLabelText('Update Widget'));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith([
        expect.objectContaining({
          id: '0',
          title: 'sdk usage',
          displayType: DisplayType.TABLE,
          interval: '5m',
          queries: [
            {
              name: 'errors',
              conditions: 'event.type:error',
              fields: ['sdk.name', 'count()', 'trace'],
              aggregates: ['count()'],
              columns: ['sdk.name', 'trace'],
              orderby: '-count()',
              fieldAliases: ['', '', ''],
            },
          ],
          widgetType: WidgetType.DISCOVER,
        }),
      ]);
    });

    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('should properly query for table fields', async function () {
    const defaultWidgetQuery = {
      name: '',
      fields: ['title', 'count()'],
      columns: ['title'],
      aggregates: ['count()'],
      conditions: '',
      orderby: '',
    };

    const defaultTableColumns = ['title', 'count()', 'count_unique(user)', 'epm()'];

    renderTestComponent({
      query: {
        source: DashboardWidgetSource.DISCOVERV2,
        defaultWidgetQuery: urlEncode(defaultWidgetQuery),
        displayType: DisplayType.LINE,
        defaultTableColumns,
      },
    });

    expect(await screen.findByText('Line Chart')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Line Chart'));
    await userEvent.click(screen.getByText('Table'));

    await waitFor(() => {
      expect(eventsMock).toHaveBeenLastCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            field: defaultTableColumns,
          }),
        })
      );
    });
  });

  it('should use defaultWidgetQuery Y-Axis and Conditions if given a defaultWidgetQuery', async function () {
    const defaultWidgetQuery = {
      name: '',
      fields: ['count()', 'failure_count()', 'count_unique(user)'],
      columns: [],
      aggregates: ['count()', 'failure_count()', 'count_unique(user)'],
      conditions: 'tag:value',
      orderby: '',
    };

    renderTestComponent({
      query: {
        source: DashboardWidgetSource.DISCOVERV2,
        defaultWidgetQuery: urlEncode(defaultWidgetQuery),
      },
    });

    expect(await screen.findByRole('row', {name: 'tag:value'})).toBeInTheDocument();

    // Table display, column, and sort field
    await waitFor(() => {
      expect(screen.getAllByText('count()')).toHaveLength(3);
    });
    // Table display and column
    expect(screen.getAllByText('failure_count()')).toHaveLength(2);
    // Table display
    expect(screen.getByText('count_unique(user)')).toBeInTheDocument();
    // Column
    expect(screen.getByText('count_unique(…)')).toBeInTheDocument();
    // Column
    expect(screen.getByText('user')).toBeInTheDocument();
  });

  it('uses displayType if given a displayType', async function () {
    renderTestComponent({
      query: {
        displayType: DisplayType.BAR,
      },
    });

    expect(await screen.findByText('Bar Chart')).toBeInTheDocument();
  });

  it('deletes the widget when the modal is confirmed', async () => {
    const handleSave = jest.fn();
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

    renderTestComponent({onSave: handleSave, dashboard, params: {widgetIndex: '0'}});

    await userEvent.click(await screen.findByText('Delete'));

    renderGlobalModal();
    await userEvent.click(await screen.findByText('Confirm'));

    await waitFor(() => {
      // The only widget was deleted
      expect(handleSave).toHaveBeenCalledWith([]);
    });

    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('persists the page filter period when updating a widget', async () => {
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
      ],
    };

    const dashboard = mockDashboard({widgets: [widget]});

    const {router} = renderTestComponent({
      dashboard,
      params: {orgId: 'org-slug', widgetIndex: '0'},
      query: {statsPeriod: '90d'},
    });

    await userEvent.click(screen.getByText('Update Widget'));

    await waitFor(() => {
      expect(router.push).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/dashboard/1/',
          query: expect.objectContaining({
            statsPeriod: '90d',
          }),
        })
      );
    });
  });

  it('renders page filters in the filter step', async () => {
    const mockReleases = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [ReleaseFixture()],
    });

    renderTestComponent({
      params: {orgId: 'org-slug'},
      query: {statsPeriod: '90d'},
      orgFeatures: defaultOrgFeatures,
    });

    expect(await screen.findByTestId('page-filter-timerange-selector')).toBeDisabled();
    expect(screen.getByTestId('page-filter-environment-selector')).toBeDisabled();
    expect(screen.getByTestId('page-filter-project-selector')).toBeDisabled();
    expect(mockReleases).toHaveBeenCalled();

    expect(screen.getByRole('button', {name: /all releases/i})).toBeDisabled();
  });

  it('appends dashboard filters to widget builder fetch data request', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [ReleaseFixture()],
    });

    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: [],
    });

    renderTestComponent({
      dashboard: {
        id: 'new',
        title: 'Dashboard',
        createdBy: undefined,
        dateCreated: '2020-01-01T00:00:00.000Z',
        widgets: [],
        projects: [],
        filters: {release: ['abc@1.2.0']},
      },
      params: {orgId: 'org-slug'},
      query: {statsPeriod: '90d'},
      orgFeatures: defaultOrgFeatures,
    });

    await waitFor(() => {
      expect(mock).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: ' release:"abc@1.2.0" ',
          }),
        })
      );
    });
  });

  it('does not error when query conditions field is blurred', async function () {
    const widget: Widget = {
      id: '0',
      title: 'sdk usage',
      interval: '5m',
      displayType: DisplayType.BAR,
      queries: [
        {
          name: 'filled in',
          conditions: 'event.type:error',
          fields: ['count()', 'count_unique(id)'],
          aggregates: ['count()', 'count_unique(id)'],
          columns: [],
          orderby: '-count()',
        },
      ],
    };

    const dashboard = mockDashboard({widgets: [widget]});
    const handleSave = jest.fn();

    renderTestComponent({dashboard, onSave: handleSave, params: {widgetIndex: '0'}});

    await userEvent.click(await screen.findByLabelText('Add Query'), {delay: null});

    // Triggering the onBlur of the new field should not error
    await userEvent.click(
      screen.getAllByPlaceholderText('Search for events, users, tags, and more')[1],
      {delay: null}
    );
    await userEvent.keyboard('{Escape}', {delay: null});

    // Run all timers because the handleBlur contains a setTimeout
    await act(tick);
  });

  it('does not wipe column changes when filters are modified', async function () {
    // widgetIndex: undefined means creating a new widget
    renderTestComponent({params: {widgetIndex: undefined}});

    await userEvent.click(await screen.findByLabelText('Add a Column'), {delay: null});
    await selectEvent.select(screen.getByText('(Required)'), /project/);

    // Triggering the onBlur of the filter should not error
    await userEvent.click(
      screen.getByPlaceholderText('Search for events, users, tags, and more'),
      {delay: null}
    );
    await userEvent.keyboard('{enter}', {delay: null});

    expect(await screen.findAllByText('project')).toHaveLength(2);
  });

  it('renders fields with commas properly', async () => {
    const defaultWidgetQuery = {
      conditions: '',
      fields: ['equation|count_if(transaction.duration,equals,300)*2'],
      aggregates: ['equation|count_if(transaction.duration,equals,300)*2'],
      columns: [],
      orderby: '',
      name: '',
    };
    const defaultTableColumns = [
      'count_if(transaction.duration,equals,300)',
      'equation|count_if(transaction.duration,equals,300)*2',
    ];
    renderTestComponent({
      query: {
        source: DashboardWidgetSource.DISCOVERV2,
        defaultWidgetQuery: urlEncode(defaultWidgetQuery),
        defaultTableColumns,
        yAxis: ['equation|count_if(transaction.duration,equals,300)*2'],
      },
    });

    expect(
      await screen.findByText('count_if(transaction.duration,equals,300)*2')
    ).toBeInTheDocument();
  });

  it('sets the correct fields for a top n widget', async () => {
    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures, 'performance-view'],
      query: {
        displayType: DisplayType.TOP_N,
      },
    });

    // Top N now opens as Area Chart
    expect(await screen.findByText('Area Chart')).toBeInTheDocument();

    // Add a group by
    await userEvent.click(screen.getByText('Add Series'));
    await selectEvent.select(screen.getByText('Select group'), /project/);

    // Change the y-axis
    await selectEvent.select(screen.getAllByText('count()')[0], 'eps()');

    await waitFor(() => {
      expect(eventsStatsMock).toHaveBeenLastCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: '',
            yAxis: ['eps()'],
            field: ['project', 'eps()'],
            topEvents: TOP_N,
            orderby: '-eps()',
          }),
        })
      );
    });
  });

  it('fetches tags when tag store is empty', async function () {
    renderTestComponent();

    await waitFor(() => {
      expect(tagsMock).toHaveBeenCalled();
    });
  });

  it('does not fetch tags when tag store is not empty', async function () {
    await act(async () => {
      TagStore.loadTagsSuccess(TagsFixture());
      renderTestComponent();
      await tick();
    });
    expect(tagsMock).not.toHaveBeenCalled();
  });

  it('excludes the Other series when grouping and using multiple y-axes', async function () {
    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures],
      query: {
        displayType: DisplayType.LINE,
      },
    });

    await selectEvent.select(await screen.findByText('Select group'), 'project');

    await userEvent.click(screen.getByText('Add Series'));
    await selectEvent.select(screen.getByText('(Required)'), /count_unique/);

    await waitFor(() => {
      expect(eventsStatsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({excludeOther: '1'}),
        })
      );
    });
  });

  it('excludes the Other series when grouping and using multiple queries', async function () {
    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures],
      query: {
        displayType: DisplayType.LINE,
      },
    });

    await selectEvent.select(await screen.findByText('Select group'), 'project');
    await userEvent.click(screen.getByText('Add Query'));

    await waitFor(() => {
      expect(eventsStatsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({excludeOther: '1'}),
        })
      );
    });
  });

  it('includes Other series when there is only one query and one y-axis', async function () {
    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures],
      query: {
        displayType: DisplayType.LINE,
      },
    });

    await selectEvent.select(await screen.findByText('Select group'), 'project');

    await waitFor(() => {
      expect(eventsStatsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.not.objectContaining({excludeOther: '1'}),
        })
      );
    });
  });

  it('decreases the limit when more y-axes and queries are added', async function () {
    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures],
      query: {
        displayType: DisplayType.LINE,
      },
    });

    await selectEvent.select(await screen.findByText('Select group'), 'project');

    screen.getByText('Limit to 5 results');

    await userEvent.click(screen.getByText('Add Query'));
    await userEvent.click(screen.getByText('Add Series'));

    expect(screen.getByText('Limit to 2 results')).toBeInTheDocument();
  });

  it('alerts the user if there are unsaved title changes', async function () {
    renderTestComponent();
    window.confirm = jest.fn();

    const customWidgetLabels = await screen.findByText('Custom Widget');
    // EditableText and chart title
    expect(customWidgetLabels).toBeInTheDocument();

    // Change title text
    await userEvent.clear(screen.getByRole('textbox', {name: 'Widget title'}));
    await userEvent.click(screen.getByRole('textbox', {name: 'Widget title'}));
    await userEvent.paste('Unique Users');
    await userEvent.keyboard('{Enter}');

    // Click Cancel
    await userEvent.click(screen.getByText('Cancel'));

    // Assert an alert was triggered
    expect(window.confirm).toHaveBeenCalled();
  });

  it('alerts the user if there are unsaved description changes', async function () {
    renderTestComponent();
    window.confirm = jest.fn();

    const descriptionTextArea = await screen.findByRole('textbox', {
      name: 'Widget Description',
    });
    expect(descriptionTextArea).toBeInTheDocument();
    expect(descriptionTextArea).toHaveAttribute(
      'placeholder',
      'Enter description (Optional)'
    );

    // Change description text
    await userEvent.clear(descriptionTextArea);
    await userEvent.click(descriptionTextArea);
    await userEvent.paste('This is a description');
    await userEvent.keyboard('{Enter}');

    // Click Cancel
    await userEvent.click(screen.getByText('Cancel'));

    // Assert an alert was triggered
    expect(window.confirm).toHaveBeenCalled();
  });

  it('does not trigger alert dialog if no changes', async function () {
    renderTestComponent();
    const alertMock = jest.spyOn(window, 'confirm');

    await userEvent.click(await screen.findByText('Cancel'));
    expect(alertMock).not.toHaveBeenCalled();
  });

  describe('Widget creation coming from other verticals', function () {
    it('redirects correctly when creating a new dashboard', async function () {
      const {router} = renderTestComponent({
        query: {source: DashboardWidgetSource.DISCOVERV2},
      });

      await userEvent.click(await screen.findByText('Add Widget'));

      await waitFor(() => {
        expect(router.push).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/organizations/org-slug/dashboards/new/',
            query: {
              displayType: 'table',
              interval: '5m',
              title: 'Custom Widget',
              queryNames: [''],
              queryConditions: [''],
              queryFields: ['count()'],
              queryOrderby: '-count()',
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

    it('redirects correctly when choosing an existing dashboard', async function () {
      const {router} = renderTestComponent({
        query: {source: DashboardWidgetSource.DISCOVERV2},
        dashboard: testDashboard,
      });

      await userEvent.click(await screen.findByText('Add Widget'));

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
              queryFields: ['count()'],
              queryOrderby: '-count()',
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

    it('shows the correct orderby when switching from a line chart to table', async function () {
      const defaultWidgetQuery = {
        name: '',
        fields: ['count_unique(user)'],
        columns: [],
        aggregates: ['count_unique(user)'],
        conditions: '',
        orderby: 'count_unique(user)',
      };

      const defaultTableColumns = ['title', 'count_unique(user)'];

      renderTestComponent({
        orgFeatures: [...defaultOrgFeatures],
        query: {
          source: DashboardWidgetSource.DISCOVERV2,
          defaultWidgetQuery: urlEncode(defaultWidgetQuery),
          displayType: DisplayType.LINE,
          defaultTableColumns,
        },
      });

      await userEvent.click(await screen.findByText('Line Chart'));
      await userEvent.click(screen.getByText('Table'));

      expect(screen.getAllByText('count_unique(user)')[0]).toBeInTheDocument();

      await waitFor(() => {
        expect(eventsMock).toHaveBeenLastCalledWith(
          '/organizations/org-slug/events/',
          expect.objectContaining({
            query: expect.objectContaining({
              field: defaultTableColumns,
              sort: ['count_unique(user)'],
            }),
          })
        );
      });
    });

    it('does not send request with orderby if a timeseries chart without grouping', async function () {
      const defaultWidgetQuery = {
        name: '',
        fields: ['count_unique(user)'],
        columns: [],
        aggregates: ['count_unique(user)'],
        conditions: '',
        orderby: 'count_unique(user)',
      };

      const defaultTableColumns = ['title', 'count_unique(user)'];

      renderTestComponent({
        orgFeatures: [...defaultOrgFeatures],
        query: {
          source: DashboardWidgetSource.DISCOVERV2,
          defaultWidgetQuery: urlEncode(defaultWidgetQuery),
          displayType: DisplayType.LINE,
          defaultTableColumns,
        },
      });

      await waitFor(() => {
        expect(eventsStatsMock).toHaveBeenLastCalledWith(
          '/organizations/org-slug/events-stats/',
          expect.objectContaining({
            query: expect.objectContaining({
              orderby: '',
            }),
          })
        );
      });
    });
  });

  it('opens top-N widgets as area display', async function () {
    const widget: Widget = {
      id: '1',
      title: 'Errors over time',
      interval: '5m',
      displayType: DisplayType.TOP_N,
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
      orgFeatures: [...defaultOrgFeatures],
      dashboard,
      params: {
        widgetIndex: '0',
      },
    });

    expect(await screen.findByText('Area Chart')).toBeInTheDocument();
  });

  it('Update table header values (field alias)', async function () {
    const handleSave = jest.fn();

    renderTestComponent({
      onSave: handleSave,
      orgFeatures: [...defaultOrgFeatures],
    });

    await userEvent.click(screen.getByPlaceholderText('Alias'));
    await userEvent.paste('First Alias');

    await userEvent.click(screen.getByLabelText('Add a Column'));

    await userEvent.click(screen.getAllByPlaceholderText('Alias')[1]);
    await userEvent.paste('Second Alias');

    await userEvent.click(screen.getByText('Add Widget'));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith([
        expect.objectContaining({
          queries: [
            expect.objectContaining({fieldAliases: ['First Alias', 'Second Alias']}),
          ],
        }),
      ]);
    });
  });

  it('does not wipe equation aliases when a column alias is updated', async function () {
    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures],
    });

    await userEvent.click(screen.getByText('Add an Equation'));
    await userEvent.click(screen.getAllByPlaceholderText('Alias')[1]);
    await userEvent.paste('This should persist');
    await userEvent.type(screen.getAllByPlaceholderText('Alias')[0], 'A');

    expect(await screen.findByText('This should persist')).toBeInTheDocument();
  });

  it('does not wipe equation aliases when a column selection is made', async function () {
    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures],
    });

    await userEvent.click(screen.getByText('Add an Equation'));
    await userEvent.click(screen.getAllByPlaceholderText('Alias')[1]);
    await userEvent.paste('This should persist');

    // 1 for the table, 1 for the column selector, 1 for the sort
    await waitFor(() => expect(screen.getAllByText('count()')).toHaveLength(3));
    await selectEvent.select(screen.getAllByText('count()')[1], /count_unique/);

    expect(screen.getByText('This should persist')).toBeInTheDocument();
  });

  it('copies over the orderby from the previous query if adding another', async function () {
    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures],
    });

    await userEvent.click(await screen.findByText('Table'));
    await userEvent.click(screen.getByText('Line Chart'));
    await selectEvent.select(screen.getByText('Select group'), 'project');
    await selectEvent.select(screen.getAllByText('count()')[1], 'count_unique(…)');

    MockApiClient.clearMockResponses();
    eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });

    await userEvent.click(screen.getByText('Add Query'));

    // Assert on two calls, one for each query
    const expectedArgs = expect.objectContaining({
      query: expect.objectContaining({
        orderby: '-count_unique(user)',
      }),
    });
    expect(eventsStatsMock).toHaveBeenNthCalledWith(
      1,
      '/organizations/org-slug/events-stats/',
      expectedArgs
    );

    expect(eventsStatsMock).toHaveBeenNthCalledWith(
      2,
      '/organizations/org-slug/events-stats/',
      expectedArgs
    );
  });

  it('disables add widget button and prevents widget previewing from firing widget query if widget query condition is invalid', async function () {
    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures],
    });
    await userEvent.click(await screen.findByText('Table'));
    await userEvent.click(screen.getByText('Line Chart'));
    expect(eventsStatsMock).toHaveBeenCalledTimes(1);

    await userEvent.click(
      await screen.findByRole('combobox', {name: 'Add a search term'})
    );
    await userEvent.paste('transaction.duration:123a');

    // Unfocus input
    await userEvent.click(screen.getByText('Filter your results'));

    expect(screen.getByText('Add Widget').closest('button')).toBeDisabled();
    expect(screen.getByText('Widget query condition is invalid.')).toBeInTheDocument();
    expect(eventsStatsMock).toHaveBeenCalledTimes(1);
  });

  describe('discover dataset split', function () {
    let widget, dashboard;
    describe('events', function () {
      beforeEach(function () {
        widget = {
          displayType: DisplayType.TABLE,
          interval: '1d',
          queries: [
            {
              name: 'Test Widget',
              fields: ['count()', 'count_unique(user)', 'epm()', 'project'],
              columns: ['project'],
              aggregates: ['count()', 'count_unique(user)', 'epm()'],
              conditions: '',
              orderby: '',
            },
          ],
          title: 'Transactions',
          id: '1',
        };

        dashboard = mockDashboard({widgets: [widget]});
      });

      it('selects the error discover split type as the dataset when the events request completes', async function () {
        eventsMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
          method: 'GET',
          statusCode: 200,
          body: {
            meta: {discoverSplitDecision: WidgetType.ERRORS},
            data: [],
          },
        });
        const mockUpdateDashboardSplitDecision = jest.fn();
        renderTestComponent({
          orgFeatures: [...defaultOrgFeatures, 'performance-discover-dataset-selector'],
          dashboard,
          params: {
            widgetIndex: '0',
          },
          updateDashboardSplitDecision: mockUpdateDashboardSplitDecision,
        });

        await waitFor(() => {
          expect(eventsMock).toHaveBeenCalled();
        });

        expect(screen.getByRole('radio', {name: /errors/i})).toBeChecked();
        expect(mockUpdateDashboardSplitDecision).toHaveBeenCalledWith(
          '1',
          WidgetType.ERRORS
        );
        expect(
          await screen.findByText(
            "We're splitting our datasets up to make it a bit easier to digest. We defaulted this widget to Errors. Edit as you see fit."
          )
        ).toBeInTheDocument();
      });

      it('selects the transaction discover split type as the dataset when the events request completes', async function () {
        eventsMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
          method: 'GET',
          statusCode: 200,
          body: {
            meta: {discoverSplitDecision: WidgetType.TRANSACTIONS},
            data: [],
          },
        });
        const mockUpdateDashboardSplitDecision = jest.fn();
        renderTestComponent({
          orgFeatures: [...defaultOrgFeatures, 'performance-discover-dataset-selector'],
          dashboard,
          params: {
            widgetIndex: '0',
          },
          updateDashboardSplitDecision: mockUpdateDashboardSplitDecision,
        });

        await waitFor(() => {
          expect(eventsMock).toHaveBeenCalled();
        });

        expect(screen.getByRole('radio', {name: /transactions/i})).toBeChecked();
        expect(mockUpdateDashboardSplitDecision).toHaveBeenCalledWith(
          '1',
          WidgetType.TRANSACTIONS
        );
        expect(
          await screen.findByText(
            "We're splitting our datasets up to make it a bit easier to digest. We defaulted this widget to Transactions. Edit as you see fit."
          )
        ).toBeInTheDocument();
      });

      it('persists the query state for tables when switching between errors and transactions', async function () {
        dashboard = mockDashboard({
          widgets: [
            WidgetFixture({
              displayType: DisplayType.TABLE,
              widgetType: WidgetType.TRANSACTIONS,
              queries: [
                {
                  name: 'Test Widget',
                  fields: ['p99(transaction.duration)'],
                  columns: [],
                  aggregates: ['p99(transaction.duration)'],
                  conditions: 'testFilter:value',
                  orderby: '',
                },
              ],
            }),
          ],
        });

        renderTestComponent({
          orgFeatures: [...defaultOrgFeatures, 'performance-discover-dataset-selector'],
          dashboard,
          params: {
            widgetIndex: '0',
          },
        });

        expect(await screen.findByText(/p99\(…\)/i)).toBeInTheDocument();
        expect(screen.getByText('transaction.duration')).toBeInTheDocument();
        expect(screen.getByRole('row', {name: 'testFilter:value'})).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: /transactions/i})).toBeChecked();

        // Switch to errors
        await userEvent.click(screen.getByRole('radio', {name: /errors/i}));

        expect(screen.getByRole('radio', {name: /transactions/i})).not.toBeChecked();
        expect(screen.getByRole('radio', {name: /errors/i})).toBeChecked();

        // The state is still the same
        expect(await screen.findByText(/p99\(…\)/i)).toBeInTheDocument();
        expect(screen.getByText('transaction.duration')).toBeInTheDocument();
        expect(screen.getByRole('row', {name: 'testFilter:value'})).toBeInTheDocument();
      });

      it('sets the correct default count_if parameters for the errors dataset', async function () {
        dashboard = mockDashboard({
          widgets: [
            WidgetFixture({
              displayType: DisplayType.TABLE,
              widgetType: WidgetType.ERRORS,
              queries: [
                {
                  name: 'Test Widget',
                  fields: ['count()'],
                  columns: [],
                  aggregates: ['count()'],
                  conditions: '',
                  orderby: '',
                },
              ],
            }),
          ],
        });

        renderTestComponent({
          orgFeatures: [...defaultOrgFeatures, 'performance-discover-dataset-selector'],
          dashboard,
          params: {
            widgetIndex: '0',
          },
        });

        await userEvent.click(await screen.findByTestId('label'));
        await userEvent.click(screen.getByText(/count_if/));

        const fieldLabels = screen.getAllByTestId('label');
        expect(fieldLabels[0]).toHaveTextContent(/count_if/);
        expect(fieldLabels[1]).toHaveTextContent('event.type');
        expect(screen.getByDisplayValue('error')).toBeInTheDocument();
      });

      it('sets the correct default count_if parameters for the transactions dataset', async function () {
        dashboard = mockDashboard({
          widgets: [
            WidgetFixture({
              displayType: DisplayType.TABLE,
              widgetType: WidgetType.TRANSACTIONS,
              queries: [
                {
                  name: 'Test Widget',
                  fields: ['count()'],
                  columns: [],
                  aggregates: ['count()'],
                  conditions: '',
                  orderby: '',
                },
              ],
            }),
          ],
        });

        renderTestComponent({
          orgFeatures: [...defaultOrgFeatures, 'performance-discover-dataset-selector'],
          dashboard,
          params: {
            widgetIndex: '0',
          },
        });

        await userEvent.click(await screen.findByTestId('label'));
        await userEvent.click(screen.getByText(/count_if/));

        const fieldLabels = screen.getAllByTestId('label');
        expect(fieldLabels[0]).toHaveTextContent(/count_if/);
        expect(fieldLabels[1]).toHaveTextContent('transaction.duration');
        expect(screen.getByDisplayValue('300')).toBeInTheDocument();
      });
    });

    describe('events-stats', function () {
      beforeEach(function () {
        widget = {
          displayType: DisplayType.LINE,
          interval: '1d',
          queries: [
            {
              name: 'Test Widget',
              fields: ['count()', 'count_unique(user)', 'epm()', 'project'],
              columns: ['project'],
              aggregates: ['count()', 'count_unique(user)', 'epm()'],
              conditions: '',
              orderby: '',
            },
          ],
          title: 'Transactions',
          id: '1',
        };

        dashboard = mockDashboard({widgets: [widget]});
      });

      it('selects the error discover split type as the dataset when the request completes', async function () {
        eventsStatsMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-stats/',
          method: 'GET',
          statusCode: 200,
          body: {
            meta: {discoverSplitDecision: WidgetType.ERRORS},
            data: [],
          },
        });
        const mockUpdateDashboardSplitDecision = jest.fn();
        renderTestComponent({
          orgFeatures: [...defaultOrgFeatures, 'performance-discover-dataset-selector'],
          dashboard,
          params: {
            widgetIndex: '0',
          },
          updateDashboardSplitDecision: mockUpdateDashboardSplitDecision,
        });

        await waitFor(() => {
          expect(eventsStatsMock).toHaveBeenCalled();
        });
        expect(screen.getByRole('radio', {name: /errors/i})).toBeChecked();
        expect(mockUpdateDashboardSplitDecision).toHaveBeenCalledWith(
          '1',
          WidgetType.ERRORS
        );
        expect(
          await screen.findByText(
            "We're splitting our datasets up to make it a bit easier to digest. We defaulted this widget to Errors. Edit as you see fit."
          )
        ).toBeInTheDocument();
      });

      it('selects the transaction discover split type as the dataset when the request completes', async function () {
        eventsStatsMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-stats/',
          method: 'GET',
          statusCode: 200,
          body: {
            meta: {discoverSplitDecision: WidgetType.TRANSACTIONS},
            data: [],
          },
        });
        const mockUpdateDashboardSplitDecision = jest.fn();
        renderTestComponent({
          orgFeatures: [...defaultOrgFeatures, 'performance-discover-dataset-selector'],
          dashboard,
          params: {
            widgetIndex: '0',
          },
          updateDashboardSplitDecision: mockUpdateDashboardSplitDecision,
        });

        await waitFor(() => {
          expect(eventsStatsMock).toHaveBeenCalled();
        });

        expect(screen.getByRole('radio', {name: /transactions/i})).toBeChecked();
        expect(mockUpdateDashboardSplitDecision).toHaveBeenCalledWith(
          '1',
          WidgetType.TRANSACTIONS
        );
        expect(
          await screen.findByText(
            "We're splitting our datasets up to make it a bit easier to digest. We defaulted this widget to Transactions. Edit as you see fit."
          )
        ).toBeInTheDocument();
      });

      it('persists the query state for timeseries when switching between errors and transactions', async function () {
        dashboard = mockDashboard({
          widgets: [
            WidgetFixture({
              displayType: DisplayType.LINE,
              widgetType: WidgetType.TRANSACTIONS,
              queries: [
                {
                  name: 'Test Widget',
                  fields: ['p99(transaction.duration)'],
                  columns: [],
                  aggregates: ['p99(transaction.duration)'],
                  conditions: 'testFilter:value',
                  orderby: '',
                },
              ],
            }),
          ],
        });

        renderTestComponent({
          orgFeatures: [...defaultOrgFeatures, 'performance-discover-dataset-selector'],
          dashboard,
          params: {
            widgetIndex: '0',
          },
        });

        expect(await screen.findByText(/p99\(…\)/i)).toBeInTheDocument();
        expect(screen.getByText('transaction.duration')).toBeInTheDocument();
        expect(screen.getByRole('row', {name: 'testFilter:value'})).toBeInTheDocument(); // Check for query builder token
        expect(screen.getByRole('radio', {name: /transactions/i})).toBeChecked();

        // Switch to errors
        await userEvent.click(screen.getByRole('radio', {name: /errors/i}));

        expect(screen.getByRole('radio', {name: /transactions/i})).not.toBeChecked();
        expect(screen.getByRole('radio', {name: /errors/i})).toBeChecked();

        // The state is still the same
        expect(await screen.findByText(/p99\(…\)/i)).toBeInTheDocument();
        expect(screen.getByText('transaction.duration')).toBeInTheDocument();
        expect(screen.getByRole('row', {name: 'testFilter:value'})).toBeInTheDocument();
      });

      it('sets the correct default count_if parameters for the errors dataset', async function () {
        dashboard = mockDashboard({
          widgets: [
            WidgetFixture({
              displayType: DisplayType.LINE,
              widgetType: WidgetType.ERRORS,
              queries: [
                {
                  name: 'Test Widget',
                  fields: ['count()'],
                  columns: [],
                  aggregates: ['count()'],
                  conditions: '',
                  orderby: '',
                },
              ],
            }),
          ],
        });

        renderTestComponent({
          orgFeatures: [...defaultOrgFeatures, 'performance-discover-dataset-selector'],
          dashboard,
          params: {
            widgetIndex: '0',
          },
        });

        await userEvent.click(await screen.findByTestId('label'));
        await userEvent.click(screen.getByText(/count_if/));

        const fieldLabels = screen.getAllByTestId('label');
        expect(fieldLabels[0]).toHaveTextContent(/count_if/);
        expect(fieldLabels[1]).toHaveTextContent('event.type');
        expect(screen.getByDisplayValue('error')).toBeInTheDocument();
      });

      it('sets the correct default count_if parameters for the transactions dataset', async function () {
        dashboard = mockDashboard({
          widgets: [
            WidgetFixture({
              displayType: DisplayType.LINE,
              widgetType: WidgetType.TRANSACTIONS,
              queries: [
                {
                  name: 'Test Widget',
                  fields: ['count()'],
                  columns: [],
                  aggregates: ['count()'],
                  conditions: '',
                  orderby: '',
                },
              ],
            }),
          ],
        });

        renderTestComponent({
          orgFeatures: [...defaultOrgFeatures, 'performance-discover-dataset-selector'],
          dashboard,
          params: {
            widgetIndex: '0',
          },
        });

        await userEvent.click(await screen.findByTestId('label'));
        await userEvent.click(screen.getByText(/count_if/));

        const fieldLabels = screen.getAllByTestId('label');
        expect(fieldLabels[0]).toHaveTextContent(/count_if/);
        expect(fieldLabels[1]).toHaveTextContent('transaction.duration');
        expect(screen.getByDisplayValue('300')).toBeInTheDocument();
      });
    });

    describe('discover split warning', function () {
      it('does not show the alert if the widget type is already split', async function () {
        dashboard = mockDashboard({
          widgets: [WidgetFixture({widgetType: WidgetType.TRANSACTIONS})],
        });
        eventsStatsMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-stats/',
          method: 'GET',
          statusCode: 200,
          body: {
            meta: {},
            data: [],
          },
        });
        renderTestComponent({
          orgFeatures: [...defaultOrgFeatures, 'performance-discover-dataset-selector'],
          dashboard,
          params: {
            widgetIndex: '0',
          },
        });

        await waitFor(() => {
          expect(screen.getByRole('radio', {name: /transactions/i})).toBeChecked();
        });
        expect(
          screen.queryByText(/we're splitting our datasets/i)
        ).not.toBeInTheDocument();
      });

      it('shows the alert if the widget is split but the decision is forced', async function () {
        dashboard = mockDashboard({
          widgets: [
            WidgetFixture({
              widgetType: WidgetType.ERRORS,
              datasetSource: DatasetSource.FORCED,
            }),
          ],
        });
        eventsStatsMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-stats/',
          method: 'GET',
          statusCode: 200,
          body: {
            meta: {},
            data: [],
          },
        });
        renderTestComponent({
          orgFeatures: [...defaultOrgFeatures, 'performance-discover-dataset-selector'],
          dashboard,
          params: {
            widgetIndex: '0',
          },
        });

        await waitFor(() => {
          expect(screen.getByRole('radio', {name: /errors/i})).toBeChecked();
        });
        expect(
          await screen.findByText(
            "We're splitting our datasets up to make it a bit easier to digest. We defaulted this widget to Errors. Edit as you see fit."
          )
        ).toBeInTheDocument();
      });

      it('is dismissable', async function () {
        dashboard = mockDashboard({
          widgets: [
            WidgetFixture({
              widgetType: WidgetType.ERRORS,
              datasetSource: DatasetSource.FORCED,
            }),
          ],
        });
        eventsStatsMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-stats/',
          method: 'GET',
          statusCode: 200,
          body: {
            meta: {},
            data: [],
          },
        });
        renderTestComponent({
          orgFeatures: [...defaultOrgFeatures, 'performance-discover-dataset-selector'],
          dashboard,
          params: {
            widgetIndex: '0',
          },
        });

        expect(
          await screen.findByText(
            "We're splitting our datasets up to make it a bit easier to digest. We defaulted this widget to Errors. Edit as you see fit."
          )
        ).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Close'}));

        expect(
          screen.queryByText(/we're splitting our datasets/i)
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Widget Library', function () {
    it('only opens the modal when the query data is changed', async function () {
      const mockModal = jest.spyOn(modals, 'openWidgetBuilderOverwriteModal');
      renderTestComponent();
      await screen.findByText('Widget Library');

      await userEvent.click(screen.getByText('Duration Distribution'));

      // Widget Library, Builder title, and Chart title
      expect(screen.getAllByText('Duration Distribution')).toHaveLength(2);

      // Confirm modal doesn't open because no changes were made
      expect(mockModal).not.toHaveBeenCalled();

      await userEvent.click(screen.getAllByLabelText('Remove this Y-Axis')[0]);
      await userEvent.click(screen.getByText('High Throughput Transactions'));

      // Should not have overwritten widget data, and confirm modal should open
      expect(screen.getAllByText('Duration Distribution')).toHaveLength(2);
      expect(mockModal).toHaveBeenCalled();
    });
  });

  describe('group by field', function () {
    it('does not contain functions as options', async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures],
      });

      expect(await screen.findByText('Select group')).toBeInTheDocument();

      await userEvent.click(screen.getByText('Select group'));

      // Only one f(x) field set in the y-axis selector
      expect(screen.getByText('f(x)')).toBeInTheDocument();
    });

    it('adds more fields when Add Group is clicked', async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures],
      });

      await userEvent.click(await screen.findByText('Add Group'));
      expect(await screen.findAllByText('Select group')).toHaveLength(2);
    });

    it("doesn't reset group by when changing y-axis", async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures],
      });

      await selectEvent.select(await screen.findByText('Select group'), 'project');
      await userEvent.click(screen.getAllByText('count()')[0], {
        skipHover: true,
      });
      await userEvent.click(screen.getByText(/count_unique/), {
        skipHover: true,
      });

      expect(await screen.findByText('project')).toBeInTheDocument();
    });

    it("doesn't erase the selection when switching to another time series", async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures],
      });

      await selectEvent.select(await screen.findByText('Select group'), 'project');

      await userEvent.click(screen.getByText('Line Chart'));
      await userEvent.click(screen.getByText('Area Chart'));

      expect(await screen.findByText('project')).toBeInTheDocument();
    });

    it('sends a top N request when a grouping is selected', async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures],
      });

      await userEvent.click(await screen.findByText('Group your results'));
      await userEvent.type(screen.getByText('Select group'), 'project{enter}');

      await waitFor(() =>
        expect(eventsStatsMock).toHaveBeenNthCalledWith(
          2,
          '/organizations/org-slug/events-stats/',
          expect.objectContaining({
            query: expect.objectContaining({
              query: '',
              yAxis: ['count()'],
              field: ['project', 'count()'],
              topEvents: TOP_N,
              orderby: '-count()',
            }),
          })
        )
      );
    });

    it('allows deleting groups until there is one left', async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures],
      });

      await userEvent.click(await screen.findByText('Add Group'));
      expect(screen.getAllByLabelText('Remove group')).toHaveLength(2);

      await userEvent.click(screen.getAllByLabelText('Remove group')[1]);
      await waitFor(() =>
        expect(screen.queryByLabelText('Remove group')).not.toBeInTheDocument()
      );
    });

    it("display 'remove' and 'drag to reorder' buttons", async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures],
      });

      expect(screen.queryByLabelText('Remove group')).not.toBeInTheDocument();

      await selectEvent.select(screen.getByText('Select group'), 'project');

      expect(screen.getByLabelText('Remove group')).toBeInTheDocument();
      expect(screen.queryByLabelText('Drag to reorder')).not.toBeInTheDocument();

      await userEvent.click(screen.getByText('Add Group'));

      expect(screen.getAllByLabelText('Remove group')).toHaveLength(2);
      expect(screen.getAllByLabelText('Drag to reorder')).toHaveLength(2);
    });

    it.todo(
      'Since simulate drag and drop with RTL is not recommended because of browser layout, remember to create acceptance test for this'
    );
  });

  describe('limit field', function () {
    it('renders if groupBy value is present', async function () {
      const handleSave = jest.fn();

      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures],
        onSave: handleSave,
      });

      await selectEvent.select(await screen.findByText('Select group'), 'project');

      expect(screen.getByText('Limit to 5 results')).toBeInTheDocument();

      await userEvent.click(screen.getByText('Add Widget'));

      await waitFor(() =>
        expect(handleSave).toHaveBeenCalledWith([
          expect.objectContaining({
            limit: 5,
          }),
        ])
      );
    });

    it('update value', async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures],
      });

      await selectEvent.select(await screen.findByText('Select group'), 'project');

      await userEvent.click(screen.getByText('Limit to 5 results'));
      await userEvent.click(screen.getByText('Limit to 2 results'));

      await waitFor(() =>
        expect(eventsStatsMock).toHaveBeenCalledWith(
          '/organizations/org-slug/events-stats/',
          expect.objectContaining({
            query: expect.objectContaining({
              query: '',
              yAxis: ['count()'],
              field: ['project', 'count()'],
              topEvents: 2,
              orderby: '-count()',
            }),
          })
        )
      );
    });

    it('gets removed if no groupBy value', async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures],
      });

      await selectEvent.select(await screen.findByText('Select group'), 'project');

      expect(screen.getByText('Limit to 5 results')).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Remove group'));

      await waitFor(() =>
        expect(screen.queryByText('Limit to 5 results')).not.toBeInTheDocument()
      );
    });

    it('applies a limit when switching from a table to timeseries chart with grouping', async function () {
      const widget: Widget = {
        displayType: DisplayType.TABLE,
        interval: '1d',
        queries: [
          {
            name: 'Test Widget',
            fields: ['count()', 'count_unique(user)', 'epm()', 'project'],
            columns: ['project'],
            aggregates: ['count()', 'count_unique(user)', 'epm()'],
            conditions: '',
            orderby: '',
          },
        ],
        title: 'Transactions',
        id: '1',
      };

      const dashboard = mockDashboard({widgets: [widget]});

      renderTestComponent({
        dashboard,
        orgFeatures: [...defaultOrgFeatures],
        params: {
          widgetIndex: '0',
        },
      });

      await userEvent.click(await screen.findByText('Table'));
      await userEvent.click(screen.getByText('Line Chart'));

      expect(screen.getByText('Limit to 3 results')).toBeInTheDocument();
      expect(eventsStatsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            topEvents: 3,
          }),
        })
      );
    });

    it('persists the limit when switching between timeseries charts', async function () {
      const widget: Widget = {
        displayType: DisplayType.AREA,
        interval: '1d',
        queries: [
          {
            name: 'Test Widget',
            fields: ['count()', 'count_unique(user)', 'epm()', 'project'],
            columns: ['project'],
            aggregates: ['count()', 'count_unique(user)', 'epm()'],
            conditions: '',
            orderby: '',
          },
        ],
        title: 'Transactions',
        id: '1',
        limit: 1,
      };

      const dashboard = mockDashboard({widgets: [widget]});

      renderTestComponent({
        dashboard,
        orgFeatures: [...defaultOrgFeatures],
        params: {
          widgetIndex: '0',
        },
      });

      await userEvent.click(await screen.findByText('Area Chart'));
      await userEvent.click(screen.getByText('Line Chart'));

      expect(screen.getByText('Limit to 1 result')).toBeInTheDocument();
      expect(eventsStatsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            topEvents: 1,
          }),
        })
      );
    });

    it('unsets the limit when going from timeseries to table', async function () {
      const widget: Widget = {
        displayType: DisplayType.AREA,
        interval: '1d',
        queries: [
          {
            name: 'Test Widget',
            fields: ['count()', 'count_unique(user)', 'epm()', 'project'],
            columns: ['project'],
            aggregates: ['count()', 'count_unique(user)', 'epm()'],
            conditions: '',
            orderby: '',
          },
        ],
        title: 'Transactions',
        id: '1',
        limit: 1,
      };

      const dashboard = mockDashboard({widgets: [widget]});

      renderTestComponent({
        dashboard,
        orgFeatures: [...defaultOrgFeatures],
        params: {
          widgetIndex: '0',
        },
      });

      await userEvent.click(await screen.findByText('Area Chart'));
      await userEvent.click(screen.getByText('Table'));

      expect(screen.queryByText('Limit to 1 result')).not.toBeInTheDocument();
      expect(eventsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            topEvents: undefined,
          }),
        })
      );
    });
  });

  describe('Spans Dataset', () => {
    it('queries for span tags and returns the correct data', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/spans/fields/`,
        body: [
          {
            key: 'plan',
            name: 'plan',
          },
        ],
        match: [
          function (_url: string, options: Record<string, any>) {
            return options.query.type === 'string';
          },
        ],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/spans/fields/`,
        body: [
          {
            key: 'tags[lcp.size,number]',
            name: 'lcp.size',
          },
          {
            key: 'tags[something.else,number]',
            name: 'something.else',
          },
        ],
        match: [
          function (_url: string, options: Record<string, any>) {
            return options.query.type === 'number';
          },
        ],
      });

      const dashboard = mockDashboard({
        widgets: [
          WidgetFixture({
            widgetType: WidgetType.SPANS,
            displayType: DisplayType.TABLE,
            queries: [
              {
                name: 'Test Widget',
                fields: ['count(tags[lcp.size,number])'],
                columns: [],
                aggregates: ['count(tags[lcp.size,number])'],
                conditions: '',
                orderby: '',
              },
            ],
          }),
        ],
      });
      renderTestComponent({
        dashboard,
        orgFeatures: [...defaultOrgFeatures, 'dashboards-eap'],
        params: {
          widgetIndex: '0',
        },
      });

      // Click the argument to the count() function
      expect(await screen.findByText('lcp.size')).toBeInTheDocument();
      await userEvent.click(screen.getByText('lcp.size'));

      // The option now appears in the aggregate property dropdown
      expect(screen.queryAllByText('lcp.size')).toHaveLength(2);
      expect(screen.getByText('something.else')).toBeInTheDocument();

      // Click count() to verify the string tag is in the dropdown
      expect(screen.queryByText('plan')).not.toBeInTheDocument();
      await userEvent.click(screen.getByText(`count(…)`));
      expect(screen.getByText('plan')).toBeInTheDocument();
    });

    it('does not show the Add Query button', async function () {
      const dashboard = mockDashboard({
        widgets: [
          WidgetFixture({
            widgetType: WidgetType.SPANS,
            // Add Query is only available for timeseries charts
            displayType: DisplayType.LINE,
            queries: [
              {
                name: 'Test Widget',
                fields: ['count(span.duration)'],
                columns: [],
                conditions: '',
                orderby: '',
                aggregates: ['count(span.duration)'],
              },
            ],
          }),
        ],
      });
      renderTestComponent({
        dashboard,
        orgFeatures: [...defaultOrgFeatures],
        params: {
          widgetIndex: '0',
        },
      });

      await screen.findByText('Line Chart');
      expect(screen.queryByText('Add Query')).not.toBeInTheDocument();
    });
  });
});
