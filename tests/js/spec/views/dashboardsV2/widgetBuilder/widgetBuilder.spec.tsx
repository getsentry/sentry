import selectEvent from 'react-select-event';
import {urlEncode} from '@sentry/utils';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountGlobalModal} from 'sentry-test/modal';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import * as indicators from 'sentry/actionCreators/indicator';
import * as modals from 'sentry/actionCreators/modal';
import TagStore from 'sentry/stores/tagStore';
import {TOP_N} from 'sentry/utils/discover/types';
import {
  DashboardDetails,
  DashboardWidgetSource,
  DisplayType,
  MAX_WIDGETS,
  Widget,
  WidgetType,
} from 'sentry/views/dashboardsV2/types';
import * as dashboardsTypes from 'sentry/views/dashboardsV2/types';
import WidgetBuilder, {WidgetBuilderProps} from 'sentry/views/dashboardsV2/widgetBuilder';

const defaultOrgFeatures = [
  'new-widget-builder-experience',
  'dashboards-edit',
  'global-views',
];

// Mocking worldMapChart to avoid act warnings
jest.mock('sentry/components/charts/worldMapChart');

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
  };

  const testDashboard: DashboardDetails = {
    id: '2',
    title: 'Test Dashboard',
    createdBy: undefined,
    dateCreated: '2020-01-01T00:00:00.000Z',
    widgets: [],
  };

  let eventsStatsMock: jest.Mock | undefined;
  let eventsv2Mock: jest.Mock | undefined;
  let metricsDataMock: jest.Mock | undefined;
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

    eventsv2Mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      method: 'GET',
      statusCode: 200,
      body: {
        meta: {},
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
      url: '/organizations/org-slug/events-geo/',
      body: {data: [], meta: {}},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/metrics/tags/`,
      body: [{key: 'environment'}, {key: 'release'}, {key: 'session.status'}],
    });

    metricsDataMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/sessions/`,
      body: TestStubs.MetricsField({
        field: `sum(session)`,
      }),
    });

    tagsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      method: 'GET',
      body: TestStubs.Tags(),
    });
    TagStore.reset();
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('no feature access', function () {
    renderTestComponent({orgFeatures: []});

    expect(screen.getByText("You don't have access to this feature")).toBeInTheDocument();
  });

  it('widget not found', function () {
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

    const dashboard: DashboardDetails = {
      id: '1',
      title: 'Dashboard',
      createdBy: undefined,
      dateCreated: '2020-01-01T00:00:00.000Z',
      widgets: [widget],
    };

    renderTestComponent({
      dashboard,
      orgFeatures: ['new-widget-builder-experience', 'dashboards-edit'],
      params: {
        widgetIndex: '2', // Out of bounds, only one widget
      },
    });

    expect(
      screen.getByText('The widget you want to edit was not found.')
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

    const dashboard: DashboardDetails = {
      id: '1',
      title: 'Dashboard',
      createdBy: undefined,
      dateCreated: '2020-01-01T00:00:00.000Z',
      widgets: [widget],
    };

    renderTestComponent({
      dashboard,
      orgFeatures: ['new-widget-builder-experience', 'dashboards-edit'],
      params: {
        widgetIndex: '0.5', // Invalid index
      },
    });

    expect(
      screen.getByText('The widget you want to edit was not found.')
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
    expect(screen.getByRole('heading', {name: 'Custom Widget'})).toBeInTheDocument();

    // Footer - Actions
    expect(screen.getByLabelText('Cancel')).toBeInTheDocument();
    expect(screen.getByLabelText('Add Widget')).toBeInTheDocument();

    // Content - Step 1
    expect(
      screen.getByRole('heading', {name: 'Choose your data set'})
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Select Errors and Transactions')).toBeChecked();

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

    expect(await screen.findByRole('link', {name: 'Dashboard'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboards/new/'
    );

    expect(screen.getByLabelText('Cancel')).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboards/new/'
    );
  });

  it('renders new design', async function () {
    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
    });

    // Switch to line chart for time series
    userEvent.click(await screen.findByText('Table'));
    userEvent.click(screen.getByText('Line Chart'));

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
    expect(screen.getByRole('heading', {name: 'Custom Widget'})).toBeInTheDocument();

    // Footer - Actions
    expect(screen.getByLabelText('Cancel')).toBeInTheDocument();
    expect(screen.getByLabelText('Add Widget')).toBeInTheDocument();

    // Content - Step 1
    expect(
      screen.getByRole('heading', {name: 'Choose your data set'})
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Select Errors and Transactions')).toBeChecked();

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

    const customWidgetLabels = await screen.findAllByText('Custom Widget');
    // EditableText and chart title
    expect(customWidgetLabels).toHaveLength(2);

    userEvent.click(customWidgetLabels[0]);
    userEvent.clear(screen.getByRole('textbox', {name: 'Widget title'}));
    userEvent.paste(screen.getByRole('textbox', {name: 'Widget title'}), 'Unique Users');
    userEvent.keyboard('{enter}');

    expect(screen.queryByText('Custom Widget')).not.toBeInTheDocument();

    expect(screen.getAllByText('Unique Users')).toHaveLength(2);
  });

  it('can add query conditions', async function () {
    const {router} = renderTestComponent({
      query: {source: DashboardWidgetSource.DISCOVERV2},
    });

    userEvent.type(
      await screen.findByRole('textbox', {name: 'Search events'}),
      'color:blue{enter}'
    );

    await selectEvent.select(screen.getByText('Select a dashboard'), 'Test Dashboard');

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
            queryConditions: ['color:blue'],
            queryFields: ['count()'],
            queryOrderby: '',
            start: null,
            end: null,
            statsPeriod: '24h',
            utc: false,
            project: [],
            environment: [],
          },
        })
      );
    });
  });

  it('can choose a field', async function () {
    const {router} = renderTestComponent({
      query: {source: DashboardWidgetSource.DISCOVERV2},
    });

    expect(await screen.findAllByText('Custom Widget')).toHaveLength(2);

    // No delete button as there is only one query.
    expect(screen.queryByLabelText('Remove query')).not.toBeInTheDocument();

    const countFields = screen.getAllByText('count()');
    expect(countFields).toHaveLength(2);

    await selectEvent.select(countFields[1], ['last_seen()']);
    await selectEvent.select(screen.getByText('Select a dashboard'), 'Test Dashboard');

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
            queryFields: ['last_seen()'],
            queryOrderby: '',
            start: null,
            end: null,
            statsPeriod: '24h',
            utc: false,
            project: [],
            environment: [],
          },
        })
      );
    });
  });

  it('can add additional fields', async function () {
    const handleSave = jest.fn();

    renderTestComponent({onSave: handleSave});

    userEvent.click(await screen.findByText('Table'));

    // Select line chart display
    userEvent.click(screen.getByText('Line Chart'));

    // Click the add overlay button
    userEvent.click(screen.getByLabelText('Add Overlay'));
    await selectEvent.select(screen.getByText('(Required)'), ['count_unique(…)']);

    userEvent.click(screen.getByLabelText('Add Widget'));

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

  it('can add equation fields', async function () {
    const handleSave = jest.fn();

    renderTestComponent({onSave: handleSave});
    userEvent.click(await screen.findByText('Table'));

    // Select line chart display
    userEvent.click(screen.getByText('Line Chart'));

    // Click the add an equation button
    userEvent.click(screen.getByLabelText('Add an Equation'));

    expect(screen.getByPlaceholderText('Equation')).toBeInTheDocument();

    userEvent.paste(screen.getByPlaceholderText('Equation'), 'count() + 100');

    userEvent.click(screen.getByLabelText('Add Widget'));

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
    jest.spyOn(indicators, 'addErrorMessage');

    renderTestComponent();

    userEvent.click(await screen.findByText('Table'));

    const customWidgetLabels = await screen.findAllByText('Custom Widget');
    // EditableText and chart title
    expect(customWidgetLabels).toHaveLength(2);

    userEvent.click(customWidgetLabels[0]);
    userEvent.clear(screen.getByRole('textbox', {name: 'Widget title'}));

    userEvent.keyboard('{enter}');

    expect(indicators.addErrorMessage).toHaveBeenCalledWith('Widget title is required');
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

    const dashboard: DashboardDetails = {
      id: '1',
      title: 'Dashboard',
      createdBy: undefined,
      dateCreated: '2020-01-01T00:00:00.000Z',
      widgets: [widget],
    };

    renderTestComponent({dashboard, params: {widgetIndex: '0'}});

    await screen.findByText('Line Chart');

    // Should be in edit 'mode'
    expect(await screen.findByText('Update Widget')).toBeInTheDocument();

    // Should set widget data up.
    expect(screen.getByText('Update Widget')).toBeInTheDocument();

    // Filters
    expect(
      screen.getAllByPlaceholderText('Search for events, users, tags, and more')
    ).toHaveLength(2);
    expect(screen.getByText('event.type:csp')).toBeInTheDocument();
    expect(screen.getByText('event.type:error')).toBeInTheDocument();

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

    const dashboard: DashboardDetails = {
      id: '1',
      title: 'Dashboard',
      createdBy: undefined,
      dateCreated: '2020-01-01T00:00:00.000Z',
      widgets: [widget],
    };

    const handleSave = jest.fn();

    renderTestComponent({onSave: handleSave, dashboard, params: {widgetIndex: '0'}});

    await screen.findByText('Line Chart');

    // Should be in edit 'mode'
    expect(await screen.findByText('Update Widget')).toBeInTheDocument();

    const customWidgetLabels = await screen.findAllByText(widget.title);
    // EditableText and chart title
    expect(customWidgetLabels).toHaveLength(2);
    userEvent.click(customWidgetLabels[0]);

    userEvent.clear(screen.getByRole('textbox', {name: 'Widget title'}));
    userEvent.paste(screen.getByRole('textbox', {name: 'Widget title'}), 'New Title');

    userEvent.click(screen.getByRole('button', {name: 'Update Widget'}));

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

    const dashboard: DashboardDetails = {
      id: '1',
      title: 'Dashboard',
      createdBy: undefined,
      dateCreated: '2020-01-01T00:00:00.000Z',
      widgets: [widget],
    };

    renderTestComponent({dashboard, params: {widgetIndex: '0'}});

    // Should be in edit 'mode'
    expect(await screen.findByText('Update Widget')).toBeInTheDocument();

    // Should set widget data up.
    expect(screen.getByRole('heading', {name: widget.title})).toBeInTheDocument();
    expect(screen.getByText('Table')).toBeInTheDocument();
    expect(screen.getByLabelText('Search events')).toBeInTheDocument();

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
          orderby: '',
        },
      ],
    };

    const dashboard: DashboardDetails = {
      id: '1',
      title: 'Dashboard',
      createdBy: undefined,
      dateCreated: '2020-01-01T00:00:00.000Z',
      widgets: [widget],
    };

    const handleSave = jest.fn();

    renderTestComponent({dashboard, onSave: handleSave, params: {widgetIndex: '0'}});

    // Should be in edit 'mode'
    expect(await screen.findByText('Update Widget')).toBeInTheDocument();
    // Add a column, and choose a value,
    userEvent.click(screen.getByLabelText('Add a Column'));
    await selectEvent.select(screen.getByText('(Required)'), 'trace');

    // Save widget
    userEvent.click(screen.getByLabelText('Update Widget'));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith([
        expect.objectContaining({
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
              orderby: '',
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
    userEvent.click(screen.getByText('Line Chart'));
    userEvent.click(screen.getByText('Table'));

    await waitFor(() => {
      expect(eventsv2Mock).toHaveBeenLastCalledWith(
        '/organizations/org-slug/eventsv2/',
        expect.objectContaining({
          query: expect.objectContaining({
            field: defaultTableColumns,
          }),
        })
      );
    });
  });

  it('should automatically add columns for top n widget charts according to the URL params', async function () {
    const defaultWidgetQuery = {
      name: '',
      fields: ['title', 'count()', 'count_unique(user)', 'epm()', 'count()'],
      columns: ['title'],
      aggregates: ['count()', 'count_unique(user)', 'epm()', 'count()'],
      conditions: 'tag:value',
      orderby: '',
    };

    renderTestComponent({
      query: {
        source: DashboardWidgetSource.DISCOVERV2,
        defaultWidgetQuery: urlEncode(defaultWidgetQuery),
        displayType: DisplayType.TOP_N,
        defaultTableColumns: ['title', 'count()', 'count_unique(user)', 'epm()'],
      },
    });

    //  Top N display
    expect(await screen.findByText('Top 5 Events')).toBeInTheDocument();

    // No delete button as there is only one field.
    expect(screen.queryByLabelText('Remove query')).not.toBeInTheDocument();

    // Restricting to a single query
    expect(screen.queryByLabelText('Add Query')).not.toBeInTheDocument();

    // Restricting to a single y-axis
    expect(screen.queryByLabelText('Add Overlay')).not.toBeInTheDocument();

    expect(screen.getByText('Choose what to plot in the y-axis')).toBeInTheDocument();

    expect(screen.getByText('Sort by a column')).toBeInTheDocument();

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getAllByText('count()')).toHaveLength(2);
    expect(screen.getByText('count_unique(…)')).toBeInTheDocument();
    expect(screen.getByText('user')).toBeInTheDocument();
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

    expect(await screen.findByText('tag:value')).toBeInTheDocument();

    // Table display and column
    expect(screen.getAllByText('count()')).toHaveLength(2);
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

  it('correctly defaults fields and orderby when in Top N display', async function () {
    const defaultWidgetQuery = {
      fields: ['title', 'count()', 'count_unique(user)'],
      columns: ['title'],
      aggregates: ['count()', 'count_unique(user)'],
      orderby: '-count_unique_user',
    };

    renderTestComponent({
      query: {
        source: DashboardWidgetSource.DISCOVERV2,
        defaultWidgetQuery: urlEncode(defaultWidgetQuery),
        displayType: DisplayType.TOP_N,
        defaultTableColumns: ['title', 'count()'],
      },
    });

    userEvent.click(await screen.findByText('Top 5 Events'));

    expect(screen.getByText('count()')).toBeInTheDocument();
    expect(screen.getByText('count_unique(…)')).toBeInTheDocument();
    expect(screen.getByText('user')).toBeInTheDocument();

    // Sort by a column
    expect(screen.getByText('Sort by a column')).toBeInTheDocument();
    expect(screen.getByText('count_unique(user) desc')).toBeInTheDocument();
  });

  it('limits TopN display to one query when switching from another visualization', async () => {
    renderTestComponent();

    userEvent.click(await screen.findByText('Table'));
    userEvent.click(screen.getByText('Bar Chart'));
    userEvent.click(screen.getByLabelText('Add Query'));
    userEvent.click(screen.getByLabelText('Add Query'));
    expect(
      screen.getAllByPlaceholderText('Search for events, users, tags, and more')
    ).toHaveLength(3);
    userEvent.click(screen.getByText('Bar Chart'));
    userEvent.click(await screen.findByText('Top 5 Events'));
    expect(
      screen.getByPlaceholderText('Search for events, users, tags, and more')
    ).toBeInTheDocument();
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
    const dashboard: DashboardDetails = {
      id: '1',
      title: 'Dashboard',
      createdBy: undefined,
      dateCreated: '2020-01-01T00:00:00.000Z',
      widgets: [widget],
    };

    renderTestComponent({onSave: handleSave, dashboard, params: {widgetIndex: '0'}});

    userEvent.click(await screen.findByText('Delete'));

    await mountGlobalModal();
    userEvent.click(await screen.findByText('Confirm'));

    await waitFor(() => {
      // The only widget was deleted
      expect(handleSave).toHaveBeenCalledWith([]);
    });

    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('persists the global selection header period when updating a widget', async () => {
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
    const dashboard: DashboardDetails = {
      id: '1',
      title: 'Dashboard',
      createdBy: undefined,
      dateCreated: '2020-01-01T00:00:00.000Z',
      widgets: [widget],
    };

    const {router} = renderTestComponent({
      dashboard,
      params: {orgId: 'org-slug', widgetIndex: '0'},
      query: {statsPeriod: '90d'},
    });

    await screen.findByText('Update Widget');
    await screen.findByText('Last 90 days');

    userEvent.click(screen.getByText('Update Widget'));

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

  it('disables dashboards with max widgets', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [
        {...untitledDashboard, widgetDisplay: []},
        {...testDashboard, widgetDisplay: [DisplayType.TABLE]},
      ],
    });

    const maxWidgetsDefaultValue = MAX_WIDGETS;

    Object.defineProperty(dashboardsTypes, 'MAX_WIDGETS', {value: 1});

    renderTestComponent({
      query: {
        source: DashboardWidgetSource.DISCOVERV2,
      },
    });

    userEvent.click(await screen.findByText('Select a dashboard'));
    userEvent.hover(screen.getByText('Test Dashboard'));
    expect(
      await screen.findByText(
        textWithMarkupMatcher('Max widgets (1) per dashboard reached.')
      )
    ).toBeInTheDocument();

    Object.defineProperty(dashboardsTypes, 'MAX_WIDGETS', {
      value: maxWidgetsDefaultValue,
    });
  });

  it('does not error when query conditions field is blurred', async function () {
    jest.useFakeTimers();
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
          orderby: '-count',
        },
      ],
    };

    const dashboard: DashboardDetails = {
      id: '1',
      title: 'Dashboard',
      createdBy: undefined,
      dateCreated: '2020-01-01T00:00:00.000Z',
      widgets: [widget],
    };

    const handleSave = jest.fn();

    renderTestComponent({dashboard, onSave: handleSave, params: {widgetIndex: '0'}});

    userEvent.click(await screen.findByLabelText('Add Query'));

    // Triggering the onBlur of the new field should not error
    userEvent.click(
      screen.getAllByPlaceholderText('Search for events, users, tags, and more')[1]
    );
    userEvent.keyboard('{esc}');
    act(() => {
      // Run all timers because the handleBlur contains a setTimeout
      jest.runAllTimers();
    });
  });

  it('does not wipe column changes when filters are modified', async function () {
    jest.useFakeTimers();

    // widgetIndex: undefined means creating a new widget
    renderTestComponent({params: {widgetIndex: undefined}});

    userEvent.click(await screen.findByLabelText('Add a Column'));
    await selectEvent.select(screen.getByText('(Required)'), /project/);

    // Triggering the onBlur of the filter should not error
    userEvent.click(
      screen.getByPlaceholderText('Search for events, users, tags, and more')
    );
    userEvent.keyboard('{enter}');
    act(() => {
      // Run all timers because the handleBlur contains a setTimeout
      jest.runAllTimers();
    });

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

    await screen.findByText('Add Widget');

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

    await screen.findByText('Add a Column');

    // Add both a field and a f(x)
    userEvent.click(screen.getByText('Add a Column'));
    await selectEvent.select(screen.getByText('(Required)'), /count_unique/);
    userEvent.click(screen.getByText('Add a Column'));
    await selectEvent.select(screen.getByText('(Required)'), /project/);

    // Change the y-axis
    await selectEvent.select(screen.getByText('count()'), 'eps()');

    // Check that no fields were lost
    await waitFor(() => {
      expect(eventsStatsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: '',
            yAxis: 'eps()',
            field: ['project', 'count_unique(user)', 'eps()'],
            topEvents: TOP_N,
          }),
        })
      );
    });
  });

  it('fetches tags when tag store is empty', function () {
    renderTestComponent();
    expect(tagsMock).toHaveBeenCalled();
  });

  it('does not fetch tags when tag store is not empty', function () {
    TagStore.loadTagsSuccess(TestStubs.Tags());
    renderTestComponent();
    expect(tagsMock).not.toHaveBeenCalled();
  });

  it('excludes the Other series when grouping and using multiple y-axes', async function () {
    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      query: {
        displayType: DisplayType.LINE,
      },
    });

    await selectEvent.select(await screen.findByText('Select group'), 'project');

    userEvent.click(screen.getByText('Add Overlay'));
    await selectEvent.select(screen.getByText('(Required)'), /count_unique/);

    await waitFor(() => {
      expect(eventsStatsMock).toBeCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({excludeOther: '1'}),
        })
      );
    });
  });

  it('excludes the Other series when grouping and using multiple queries', async function () {
    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      query: {
        displayType: DisplayType.LINE,
      },
    });

    await selectEvent.select(await screen.findByText('Select group'), 'project');
    userEvent.click(screen.getByText('Add Query'));

    await waitFor(() => {
      expect(eventsStatsMock).toBeCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({excludeOther: '1'}),
        })
      );
    });
  });

  it('includes Other series when there is only one query and one y-axis', async function () {
    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      query: {
        displayType: DisplayType.LINE,
      },
    });

    await selectEvent.select(await screen.findByText('Select group'), 'project');

    await waitFor(() => {
      expect(eventsStatsMock).toBeCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.not.objectContaining({excludeOther: '1'}),
        })
      );
    });
  });

  it('decreases the limit when more y-axes and queries are added', async function () {
    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      query: {
        displayType: DisplayType.LINE,
      },
    });

    await selectEvent.select(await screen.findByText('Select group'), 'project');

    screen.getByText('Limit to 5 results');

    userEvent.click(screen.getByText('Add Query'));
    userEvent.click(screen.getByText('Add Query'));

    screen.getByText('Limit to 3 results');

    userEvent.click(screen.getByText('Add Overlay'));
    userEvent.click(screen.getByText('Add Overlay'));

    await screen.findByText('Limit to 1 result');
  });

  describe('Sort by selectors', function () {
    it('renders', async function () {
      renderTestComponent({
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      });

      expect(await screen.findByText('Sort by a column')).toBeInTheDocument();
      expect(
        screen.getByText("Choose one of the columns you've created to sort by.")
      ).toBeInTheDocument();

      // Selector "sortDirection"
      expect(screen.getByText('High to low')).toBeInTheDocument();
      // Selector "sortBy"
      expect(screen.getAllByText('count()')).toHaveLength(3);
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

      const dashboard: DashboardDetails = {
        id: '1',
        title: 'Dashboard',
        createdBy: undefined,
        dateCreated: '2020-01-01T00:00:00.000Z',
        widgets: [widget],
      };

      renderTestComponent({
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
        dashboard,
        params: {
          widgetIndex: '0',
        },
      });

      // Click on the displayType selector
      userEvent.click(await screen.findByText('Line Chart'));

      // Choose the table visualization
      userEvent.click(screen.getByText('Table'));

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
            orderby: '-count',
          },
        ],
      };

      const dashboard: DashboardDetails = {
        id: '1',
        title: 'Dashboard',
        createdBy: undefined,
        dateCreated: '2020-01-01T00:00:00.000Z',
        widgets: [widget],
      };

      renderTestComponent({
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
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

      await selectEvent.select(screen.getAllByText('count()')[2], 'count_unique(id)');

      // Wait for the Builder update the widget values
      await waitFor(() => {
        expect(screen.getAllByText('count()')).toHaveLength(2);
      });

      // Now count_unique(id) is selected in the "sortBy" selector
      expect(screen.getAllByText('count_unique(id)')).toHaveLength(2);

      await selectEvent.select(screen.getByText('High to low'), 'Low to high');

      // Saves the widget
      userEvent.click(screen.getByText('Update Widget'));

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith([
          expect.objectContaining({
            queries: [expect.objectContaining({orderby: 'count_unique_id'})],
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
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
        query: {
          source: DashboardWidgetSource.DISCOVERV2,
          defaultWidgetQuery: urlEncode(defaultWidgetQuery),
          displayType: DisplayType.TABLE,
          defaultTableColumns: ['title', 'count()', 'count_unique(user)', 'epm()'],
        },
      });

      expect(await screen.findByText('Sort by a column')).toBeInTheDocument();

      // Selector "sortDirection"
      expect(screen.getByText('Low to high')).toBeInTheDocument();

      // Selector "sortBy"
      expect(screen.getAllByText('title')).toHaveLength(2);

      // Saves the widget
      userEvent.click(screen.getByText('Add Widget'));

      await waitFor(() => {
        expect(router.push).toHaveBeenCalledWith(
          expect.objectContaining({
            query: expect.objectContaining({queryOrderby: 'count'}),
          })
        );
      });
    });
  });

  describe('Widget creation coming from other verticals', function () {
    it('redirects correctly when creating a new dashboard', async function () {
      const {router} = renderTestComponent({
        query: {source: DashboardWidgetSource.DISCOVERV2},
      });

      expect(await screen.findByText('Choose your dashboard')).toBeInTheDocument();
      expect(
        screen.getByText(
          "Choose which dashboard you'd like to add this query to. It will appear as a widget."
        )
      ).toBeInTheDocument();

      await selectEvent.select(
        screen.getByText('Select a dashboard'),
        '+ Create New Dashboard'
      );
      userEvent.click(screen.getByText('Add Widget'));

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
              queryOrderby: '',
              start: null,
              end: null,
              statsPeriod: '24h',
              utc: false,
              project: [],
              environment: [],
            },
          })
        );
      });
    });

    it('redirects correctly when choosing an existing dashboard', async function () {
      const {router} = renderTestComponent({
        query: {source: DashboardWidgetSource.DISCOVERV2},
      });

      userEvent.click(await screen.findByText('Select a dashboard'));
      userEvent.click(screen.getByText('Test Dashboard'));
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
              queryFields: ['count()'],
              queryOrderby: '',
              start: null,
              end: null,
              statsPeriod: '24h',
              utc: false,
              project: [],
              environment: [],
            },
          })
        );
      });
    });
  });

  it('opens top-N widgets as top-N display', async function () {
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
          orderby: '-count',
        },
      ],
    };

    const dashboard: DashboardDetails = {
      id: '1',
      title: 'Dashboard',
      createdBy: undefined,
      dateCreated: '2020-01-01T00:00:00.000Z',
      widgets: [widget],
    };

    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      dashboard,
      params: {
        widgetIndex: '0',
      },
    });

    expect(await screen.findByText('Top 5 Events')).toBeInTheDocument();
  });

  it('Update table header values (field alias)', async function () {
    const handleSave = jest.fn();

    renderTestComponent({
      onSave: handleSave,
      orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
    });

    await screen.findByText('Table');

    userEvent.paste(screen.getByPlaceholderText('Alias'), 'First Alias');

    userEvent.click(screen.getByLabelText('Add a Column'));

    userEvent.paste(screen.getAllByPlaceholderText('Alias')[1], 'Second Alias');

    userEvent.click(screen.getByText('Add Widget'));

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
      orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
    });

    await screen.findByText('Table');

    userEvent.click(screen.getByText('Add an Equation'));
    userEvent.paste(screen.getAllByPlaceholderText('Alias')[1], 'This should persist');
    userEvent.type(screen.getAllByPlaceholderText('Alias')[0], 'A');

    expect(screen.getByText('This should persist')).toBeInTheDocument();
  });

  it('does not wipe equation aliases when a column selection is made', async function () {
    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
    });

    await screen.findByText('Table');

    userEvent.click(screen.getByText('Add an Equation'));
    userEvent.paste(screen.getAllByPlaceholderText('Alias')[1], 'This should persist');

    await selectEvent.select(screen.getAllByText('count()')[1], /count_unique/);

    expect(screen.getByText('This should persist')).toBeInTheDocument();
  });

  it('copies over the orderby from the previous query if adding another', async function () {
    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
    });

    userEvent.click(await screen.findByText('Table'));
    userEvent.click(screen.getByText('Line Chart'));
    await selectEvent.select(screen.getAllByText('count()')[0], 'count_unique(…)');

    MockApiClient.clearMockResponses();
    eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });

    userEvent.click(screen.getByText('Add Query'));

    // Assert on two calls, one for each query
    const expectedArgs = expect.objectContaining({
      query: expect.objectContaining({
        orderby: '-count_unique_user',
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
                orderby: '',
              },
            ],
          }),
        ]);
      });

      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    it('render issues data set disabled when the display type is not set to table', async function () {
      renderTestComponent({
        query: {
          source: DashboardWidgetSource.DISCOVERV2,
        },
      });

      userEvent.click(await screen.findByText('Table'));
      userEvent.click(screen.getByText('Line Chart'));
      expect(
        screen.getByRole('radio', {
          name: 'Select Errors and Transactions',
        })
      ).toBeEnabled();
      expect(
        screen.getByRole('radio', {
          name: 'Select Issues (States, Assignment, Time, etc.)',
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

      userEvent.paste(
        await screen.findByPlaceholderText('Search for events, users, tags, and more'),
        'is:',
        {
          clipboardData: {getData: () => ''},
        } as unknown as React.ClipboardEvent<HTMLTextAreaElement>
      );
      expect(await screen.findByText('No items found')).toBeInTheDocument();
    });

    it('renders with an issues search bar when selected in dataset selection', async function () {
      renderTestComponent();

      userEvent.click(await screen.findByText('Issues (States, Assignment, Time, etc.)'));
      userEvent.paste(
        screen.getByPlaceholderText('Search for events, users, tags, and more'),
        'is:',
        {
          clipboardData: {getData: () => ''},
        } as unknown as React.ClipboardEvent<HTMLTextAreaElement>
      );
      expect(await screen.findByText('resolved')).toBeInTheDocument();
    });

    // Disabling for CI, but should run locally when making changes
    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('Update table header values (field alias)', async function () {
      const handleSave = jest.fn();

      renderTestComponent({
        onSave: handleSave,
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      });

      await screen.findByText('Table');

      userEvent.click(screen.getByText('Issues (States, Assignment, Time, etc.)'));

      userEvent.type(screen.getAllByPlaceholderText('Alias')[0], 'First Alias{enter}');

      userEvent.type(screen.getAllByPlaceholderText('Alias')[1], 'Second Alias{enter}');

      userEvent.type(screen.getAllByPlaceholderText('Alias')[2], 'Third Alias{enter}');

      userEvent.click(screen.getByText('Add Widget'));

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith([
          expect.objectContaining({
            queries: [
              expect.objectContaining({
                fieldAliases: ['First Alias', 'Second Alias', 'Third Alias'],
              }),
            ],
          }),
        ]);
      });
    });
  });

  describe('Release Widgets', function () {
    const releaseHealthFeatureFlags = [
      ...defaultOrgFeatures,
      'new-widget-builder-experience-design',
      'dashboards-metrics',
    ];

    it('does not show the Release Health data set if there is no dashboards-metrics flag', async function () {
      renderTestComponent({
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      });

      expect(await screen.findByText('Errors and Transactions')).toBeInTheDocument();
      expect(
        screen.queryByText('Releases (sessions, crash rates)')
      ).not.toBeInTheDocument();
    });

    it('shows the Release Health data set if there is the dashboards-metrics flag', async function () {
      renderTestComponent({
        orgFeatures: releaseHealthFeatureFlags,
      });

      expect(await screen.findByText('Errors and Transactions')).toBeInTheDocument();
      expect(screen.getByText('Releases (sessions, crash rates)')).toBeInTheDocument();
    });

    it('maintains the selected dataset when display type is changed', async function () {
      renderTestComponent({
        orgFeatures: releaseHealthFeatureFlags,
      });

      expect(
        await screen.findByText('Releases (sessions, crash rates)')
      ).toBeInTheDocument();

      expect(screen.getByLabelText(/releases/i)).not.toBeChecked();
      userEvent.click(screen.getByLabelText(/releases/i));
      await waitFor(() => expect(screen.getByLabelText(/releases/i)).toBeChecked());

      userEvent.click(screen.getByText('Table'));
      userEvent.click(screen.getByText('Line Chart'));
      await waitFor(() => expect(screen.getByLabelText(/releases/i)).toBeChecked());
    });

    it('displays metrics tags', async function () {
      renderTestComponent({
        orgFeatures: releaseHealthFeatureFlags,
      });

      expect(
        await screen.findByText('Releases (sessions, crash rates)')
      ).toBeInTheDocument();

      userEvent.click(screen.getByLabelText(/releases/i));

      expect(screen.getByText('sum(…)')).toBeInTheDocument();
      expect(screen.getByText('session')).toBeInTheDocument();

      userEvent.click(screen.getByText('sum(…)'));
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
        await screen.findByText('Releases (sessions, crash rates)')
      ).toBeInTheDocument();

      userEvent.click(screen.getByLabelText(/releases/i));

      expect(screen.getByText('sum(…)')).toBeInTheDocument();
      await selectEvent.select(screen.getByText('sum(…)'), 'count_unique(…)');

      userEvent.click(screen.getByText('user'));
      expect(screen.queryByText('release')).not.toBeInTheDocument();
      expect(screen.queryByText('environment')).not.toBeInTheDocument();
      expect(screen.queryByText('session.status')).not.toBeInTheDocument();
    });

    it('makes the appropriate sessions call', async function () {
      renderTestComponent({
        orgFeatures: releaseHealthFeatureFlags,
      });

      expect(
        await screen.findByText('Releases (sessions, crash rates)')
      ).toBeInTheDocument();

      userEvent.click(screen.getByLabelText(/releases/i));

      userEvent.click(screen.getByText('Table'));
      userEvent.click(screen.getByText('Line Chart'));

      await waitFor(() =>
        expect(metricsDataMock).toHaveBeenLastCalledWith(
          `/organizations/org-slug/sessions/`,
          expect.objectContaining({
            query: {
              environment: [],
              field: [`sum(session)`],
              orderBy: '-sum(session)',
              groupBy: [],
              interval: '1h',
              project: [],
              statsPeriod: '24h',
            },
          })
        )
      );
    });

    it('displays the correct options for area chart', async function () {
      renderTestComponent({
        orgFeatures: releaseHealthFeatureFlags,
      });

      expect(
        await screen.findByText('Releases (sessions, crash rates)')
      ).toBeInTheDocument();

      // change data set to metrics
      userEvent.click(screen.getByLabelText(/releases/i));

      userEvent.click(screen.getByText('Table'));
      userEvent.click(screen.getByText('Line Chart'));

      expect(screen.getByText('sum(…)')).toBeInTheDocument();
      expect(screen.getByText(`session`)).toBeInTheDocument();

      userEvent.click(screen.getByText('sum(…)'));
      expect(screen.getByText('count_unique(…)')).toBeInTheDocument();

      userEvent.click(screen.getByText('count_unique(…)'));
      expect(screen.getByText('user')).toBeInTheDocument();
    });

    it('sets widgetType to release', async function () {
      const handleSave = jest.fn();

      renderTestComponent({
        onSave: handleSave,
        orgFeatures: releaseHealthFeatureFlags,
      });

      userEvent.click(await screen.findByText('Releases (sessions, crash rates)'));
      userEvent.click(screen.getByLabelText('Add Widget'));

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith([
          expect.objectContaining({
            // TODO(adam): Update widget type to be 'release'
            widgetType: WidgetType.METRICS,
            queries: [
              expect.objectContaining({
                aggregates: [`sum(session)`],
                fields: [`sum(session)`],
                orderby: `-sum(session)`,
              }),
            ],
          }),
        ]);
      });

      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    it('does not display "add an equation" button', async function () {
      const widget: Widget = {
        title: 'Metrics Widget',
        displayType: DisplayType.TABLE,
        widgetType: WidgetType.METRICS,
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

      const dashboard: DashboardDetails = {
        id: '1',
        title: 'Dashboard',
        createdBy: undefined,
        dateCreated: '2020-01-01T00:00:00.000Z',
        widgets: [widget],
      };

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

    it('render release data set disabled when the display type is world map', async function () {
      renderTestComponent({
        query: {
          source: DashboardWidgetSource.DISCOVERV2,
        },
        orgFeatures: releaseHealthFeatureFlags,
      });

      userEvent.click(await screen.findByText('Table'));
      userEvent.click(screen.getByText('World Map'));

      await waitFor(() =>
        expect(
          screen.getByRole('radio', {
            name: 'Select Releases (sessions, crash rates)',
          })
        ).toBeDisabled()
      );

      expect(
        screen.getByRole('radio', {
          name: 'Select Errors and Transactions',
        })
      ).toBeEnabled();
      expect(
        screen.getByRole('radio', {
          name: 'Select Issues (States, Assignment, Time, etc.)',
        })
      ).toBeDisabled();
    });

    // Disabling for CI, but should run locally when making changes
    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('renders with a release search bar', async function () {
      renderTestComponent({
        orgFeatures: releaseHealthFeatureFlags,
      });

      userEvent.type(
        await screen.findByPlaceholderText('Search for events, users, tags, and more'),
        'session.status:'
      );
      expect(await screen.findByText('No items found')).toBeInTheDocument();

      userEvent.click(screen.getByText('Releases (sessions, crash rates)'));
      userEvent.type(
        screen.getByPlaceholderText('Search for events, users, tags, and more'),
        'session.status:'
      );
      expect(await screen.findByText('crashed')).toBeInTheDocument();
    });
  });

  describe('Widget Library', function () {
    it('renders', async function () {
      renderTestComponent();
      expect(await screen.findByText('Widget Library')).toBeInTheDocument();
    });

    it('only opens the modal when the query data is changed', async function () {
      const mockModal = jest.spyOn(modals, 'openWidgetBuilderOverwriteModal');
      renderTestComponent();
      await screen.findByText('Widget Library');

      userEvent.click(screen.getByText('Duration Distribution'));

      // Widget Library, Builder title, and Chart title
      expect(await screen.findAllByText('Duration Distribution')).toHaveLength(3);

      // Confirm modal doesn't open because no changes were made
      expect(mockModal).not.toHaveBeenCalled();

      userEvent.click(screen.getAllByLabelText('Remove this Y-Axis')[0]);
      userEvent.click(screen.getByText('High Throughput Transactions'));

      // Should not have overwritten widget data, and confirm modal should open
      expect(await screen.findAllByText('Duration Distribution')).toHaveLength(3);
      expect(mockModal).toHaveBeenCalled();
    });
  });

  // Disabling for CI, but should run locally when making changes
  // eslint-disable-next-line jest/no-disabled-tests
  describe.skip('group by field', function () {
    it('does not contain functions as options', async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      });

      await screen.findByText('Group your results');

      expect(screen.getByText('Select group')).toBeInTheDocument();

      userEvent.click(screen.getByText('Select group'));

      // Only one f(x) field set in the y-axis selector
      expect(screen.getByText('f(x)')).toBeInTheDocument();
    });

    it('adds more fields when Add Group is clicked', async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      });

      await screen.findByText('Group your results');
      userEvent.click(screen.getByText('Add Group'));
      expect(await screen.findAllByText('Select group')).toHaveLength(2);
    });

    it('allows adding up to GROUP_BY_LIMIT fields', async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      });

      await screen.findByText('Group your results');

      for (let i = 0; i < 19; i++) {
        userEvent.click(screen.getByText('Add Group'));
      }

      expect(await screen.findAllByText('Select group')).toHaveLength(20);
      expect(screen.queryByText('Add Group')).not.toBeInTheDocument();
    });

    it("doesn't reset group by when changing y-axis", async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      });

      await selectEvent.select(await screen.findByText('Select group'), 'project');
      userEvent.click(screen.getAllByText('count()')[0], undefined, {skipHover: true});
      userEvent.click(screen.getByText(/count_unique/), undefined, {skipHover: true});

      expect(await screen.findByText('project')).toBeInTheDocument();
    });

    it("doesn't erase the selection when switching to another time series", async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      });

      await selectEvent.select(await screen.findByText('Select group'), 'project');

      userEvent.click(screen.getByText('Line Chart'));
      userEvent.click(screen.getByText('Area Chart'));

      expect(await screen.findByText('project')).toBeInTheDocument();
    });

    it('sends a top N request when a grouping is selected', async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      });

      userEvent.click(await screen.findByText('Group your results'));
      userEvent.type(screen.getByText('Select group'), 'project{enter}');

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
              orderby: '-count',
            }),
          })
        )
      );
    });

    it('allows deleting groups until there is one left', async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      });

      await screen.findByText('Group your results');
      userEvent.click(screen.getByText('Add Group'));
      expect(screen.getAllByLabelText('Remove group')).toHaveLength(2);

      userEvent.click(screen.getAllByLabelText('Remove group')[1]);
      await waitFor(() =>
        expect(screen.queryByLabelText('Remove group')).not.toBeInTheDocument()
      );
    });

    it("display 'remove' and 'drag to reorder' buttons", async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      });

      await screen.findByText('Select group');

      expect(screen.queryByLabelText('Remove group')).not.toBeInTheDocument();

      await selectEvent.select(screen.getByText('Select group'), 'project');

      expect(screen.getByLabelText('Remove group')).toBeInTheDocument();
      expect(screen.queryByLabelText('Drag to reorder')).not.toBeInTheDocument();

      userEvent.click(screen.getByText('Add Group'));

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
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
        onSave: handleSave,
      });

      await selectEvent.select(await screen.findByText('Select group'), 'project');

      expect(screen.getByText('Limit to 5 results')).toBeInTheDocument();

      userEvent.click(screen.getByText('Add Widget'));

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
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      });

      await selectEvent.select(await screen.findByText('Select group'), 'project');

      userEvent.click(screen.getByText('Limit to 5 results'));
      userEvent.click(screen.getByText('Limit to 2 results'));

      await waitFor(() =>
        expect(eventsStatsMock).toHaveBeenCalledWith(
          '/organizations/org-slug/events-stats/',
          expect.objectContaining({
            query: expect.objectContaining({
              query: '',
              yAxis: ['count()'],
              field: ['project', 'count()'],
              topEvents: 2,
              orderby: '-count',
            }),
          })
        )
      );
    });

    it('gets removed if no groupBy value', async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      });

      await selectEvent.select(await screen.findByText('Select group'), 'project');

      expect(screen.getByText('Limit to 5 results')).toBeInTheDocument();

      userEvent.click(screen.getByLabelText('Remove group'));

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

      const dashboard: DashboardDetails = {
        id: '1',
        title: 'Dashboard',
        createdBy: undefined,
        dateCreated: '2020-01-01T00:00:00.000Z',
        widgets: [widget],
      };

      renderTestComponent({
        dashboard,
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
        params: {
          widgetIndex: '0',
        },
      });

      userEvent.click(await screen.findByText('Table'));
      userEvent.click(screen.getByText('Line Chart'));

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

      const dashboard: DashboardDetails = {
        id: '1',
        title: 'Dashboard',
        createdBy: undefined,
        dateCreated: '2020-01-01T00:00:00.000Z',
        widgets: [widget],
      };

      renderTestComponent({
        dashboard,
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
        params: {
          widgetIndex: '0',
        },
      });

      userEvent.click(await screen.findByText('Area Chart'));
      userEvent.click(screen.getByText('Line Chart'));

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

      const dashboard: DashboardDetails = {
        id: '1',
        title: 'Dashboard',
        createdBy: undefined,
        dateCreated: '2020-01-01T00:00:00.000Z',
        widgets: [widget],
      };

      renderTestComponent({
        dashboard,
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
        params: {
          widgetIndex: '0',
        },
      });

      userEvent.click(await screen.findByText('Area Chart'));
      userEvent.click(screen.getByText('Table'));

      expect(screen.queryByText('Limit to 1 result')).not.toBeInTheDocument();
      expect(eventsv2Mock).toHaveBeenCalledWith(
        '/organizations/org-slug/eventsv2/',
        expect.objectContaining({
          query: expect.objectContaining({
            topEvents: undefined,
          }),
        })
      );
    });
  });
});
