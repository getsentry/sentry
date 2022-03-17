import React from 'react';
import {urlEncode} from '@sentry/utils';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountGlobalModal} from 'sentry-test/modal';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import * as indicators from 'sentry/actionCreators/indicator';
import * as modals from 'sentry/actionCreators/modal';
import {TOP_N} from 'sentry/utils/discover/types';
import {
  DashboardDetails,
  DashboardWidgetSource,
  DisplayType,
  MAX_WIDGETS,
  Widget,
} from 'sentry/views/dashboardsV2/types';
import * as dashboardsTypes from 'sentry/views/dashboardsV2/types';
import WidgetBuilder, {WidgetBuilderProps} from 'sentry/views/dashboardsV2/widgetBuilder';

// Mock World Map because setState inside componentDidMount is
// throwing UnhandledPromiseRejection
jest.mock('sentry/components/charts/worldMapChart');

const defaultOrgFeatures = [
  'new-widget-builder-experience',
  'dashboards-edit',
  'global-views',
];

function renderTestComponent({
  widget,
  dashboard,
  query,
  orgFeatures,
  onSave,
  params,
}: {
  dashboard?: WidgetBuilderProps['dashboard'];
  onSave?: WidgetBuilderProps['onSave'];
  orgFeatures?: string[];
  params?: WidgetBuilderProps['params'];
  query?: Record<string, any>;
  widget?: WidgetBuilderProps['widget'];
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
      dashboard={
        dashboard ?? {
          id: '1',
          title: 'Dashboard',
          createdBy: undefined,
          dateCreated: '2020-01-01T00:00:00.000Z',
          widgets: [],
        }
      }
      onSave={onSave ?? jest.fn()}
      widget={widget}
      params={{
        orgId: organization.slug,
        widgetIndex: widget ? 0 : undefined,
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
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
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

    renderTestComponent({
      widget,
      orgFeatures: ['new-widget-builder-experience', 'dashboards-edit'],
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
    expect(
      screen.getByLabelText('Select All Events (Errors and Transactions)')
    ).toBeChecked();

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

  it('renders new design', async function () {
    renderTestComponent({
      orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
    });

    // Switch to line chart for time series
    userEvent.click(await screen.findByText('Table'));
    userEvent.click(screen.getByText('Line Chart'));

    // Header - Breadcrumbs
    expect(screen.getByRole('link', {name: 'Dashboards'})).toHaveAttribute(
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
    expect(
      screen.getByLabelText('Select All Events (Errors and Transactions)')
    ).toBeChecked();

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

    userEvent.click(screen.getByText('Select a dashboard'));
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

    userEvent.click(countFields[1]);
    userEvent.type(countFields[1], 'last');
    userEvent.click(screen.getByText('last_seen()'));

    userEvent.click(screen.getByText('Select a dashboard'));
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

    userEvent.click(screen.getByText('(Required)'));
    userEvent.type(screen.getByText('(Required)'), 'count_unique(…){enter}');

    userEvent.click(screen.getByLabelText('Add Widget'));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith([
        expect.objectContaining({
          title: 'Custom Widget',
          displayType: 'line',
          interval: '5m',
          widgetType: 'discover',
          queries: [
            {
              conditions: '',
              fields: ['count()', 'count_unique(user)'],
              aggregates: ['count()', 'count_unique(user)'],
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
          displayType: 'line',
          interval: '5m',
          widgetType: 'discover',
          queries: [
            {
              name: '',
              fields: ['count()', 'equation|count() + 100'],
              aggregates: ['count()', 'equation|count() + 100'],
              columns: [],
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

    renderTestComponent({onSave: handleSave, dashboard, widget});

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

    const customWidgetLabels = await screen.findAllByText(widget.title);
    // EditableText and chart title
    expect(customWidgetLabels).toHaveLength(2);
    userEvent.click(customWidgetLabels[0]);

    userEvent.clear(screen.getByRole('textbox', {name: 'Widget title'}));
    userEvent.type(
      screen.getByRole('textbox', {name: 'Widget title'}),
      'New Title{enter}'
    );

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

    const handleSave = jest.fn();

    renderTestComponent({dashboard, widget, onSave: handleSave});

    // Should be in edit 'mode'
    expect(await screen.findByText('Update Widget')).toBeInTheDocument();

    // Should set widget data up.
    expect(screen.getByRole('heading', {name: widget.title})).toBeInTheDocument();
    expect(screen.getByText('Table')).toBeInTheDocument();
    expect(screen.getByLabelText('Search events')).toBeInTheDocument();

    // Should have an orderby select
    expect(screen.getByText('Sort by a column')).toBeInTheDocument();

    // Add a column, and choose a value,
    userEvent.click(screen.getByLabelText('Add a Column'));
    userEvent.click(screen.getByText('(Required)'));
    userEvent.type(screen.getByText('(Required)'), 'trace{enter}');

    // Save widget
    userEvent.click(screen.getByLabelText('Update Widget'));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith([
        expect.objectContaining({
          title: 'sdk usage',
          displayType: 'table',
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
          widgetType: 'discover',
        }),
      ]);
    });

    expect(handleSave).toHaveBeenCalledTimes(1);
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

    renderTestComponent({onSave: handleSave, dashboard, widget});

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
      widget,
      params: {orgId: 'org-slug', dashboardId: '1'},
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
      expect(screen.getByText('Low to high')).toBeInTheDocument();
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
        widget,
      });

      // Click on the displayType selector
      userEvent.click(await screen.findByText('Line Chart'));

      // Choose the table visualization
      userEvent.click(screen.getByText('Table'));

      expect(await screen.findByText('Sort by a column')).toBeInTheDocument();

      // Selector "sortDirection"
      expect(screen.getByText('Low to high')).toBeInTheDocument();

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
        widget,
        onSave: handleSave,
      });

      expect(await screen.findByText('Sort by a column')).toBeInTheDocument();

      // Selector "sortDirection"
      expect(screen.getByText('Low to high')).toBeInTheDocument();

      // Selector "sortBy"
      expect(screen.getAllByText('count()')).toHaveLength(3);

      // Click on the "sortBy" selector
      userEvent.click(screen.getAllByText('count()')[2]);

      // menu of the "sortBy" selector is being displayed
      expect(screen.getAllByText('count_unique(id)')).toHaveLength(2);

      // Click on the second option of the "sortBy" selector
      userEvent.click(screen.getAllByText('count_unique(id)')[1]);

      // Wait for the Builder update the widget values
      await waitFor(() => {
        expect(screen.getAllByText('count()')).toHaveLength(2);
      });

      // Now count_unique(id) is selected in the "sortBy" selector
      expect(screen.getAllByText('count_unique(id)')).toHaveLength(2);

      // Click on the "sortDirection" selector
      userEvent.click(screen.getByText('Low to high'));

      // Select the other option
      userEvent.click(screen.getByText('High to low'));

      // Saves the widget
      userEvent.click(screen.getByText('Update Widget'));

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith([
          expect.objectContaining({
            queries: [expect.objectContaining({orderby: '-count_unique_id'})],
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
      userEvent.click(screen.getAllByText('title')[1]);

      userEvent.click(screen.getByText('Select a dashboard'));
      userEvent.click(screen.getByText('+ Create New Dashboard'));

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

      userEvent.click(screen.getByText('Select a dashboard'));
      userEvent.click(screen.getByText('+ Create New Dashboard'));
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
            displayType: 'table',
            interval: '5m',
            widgetType: 'issue',
            queries: [
              {
                conditions: '',
                fields: ['issue', 'assignee', 'title'],
                columns: ['issue', 'assignee', 'title'],
                aggregates: [],
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
          name: 'Select All Events (Errors and Transactions)',
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

    it('allows deleting groups until there is one left', async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      });

      await screen.findByText('Group your results');
      userEvent.click(screen.getByText('Add Group'));
      expect(screen.getAllByLabelText('Remove group')).toHaveLength(2);

      userEvent.click(screen.getAllByLabelText('Remove group')[1]);
      expect(screen.queryByLabelText('Remove group')).not.toBeInTheDocument();
    });

    it("doesn't reset group by when changing y-axis", async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      });

      userEvent.click(await screen.findByText('Group your results'));
      userEvent.type(screen.getByText('Select group'), 'project{enter}');
      userEvent.click(screen.getByText('count()'), undefined, {skipHover: true});
      userEvent.click(screen.getByText(/count_unique/), undefined, {skipHover: true});

      expect(screen.getByText('project')).toBeInTheDocument();
    });

    it("doesn't erase the selection when switching to another time series", async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      });

      userEvent.click(await screen.findByText('Group your results'));
      userEvent.type(screen.getByText('Select group'), 'project{enter}');

      userEvent.click(screen.getByText('Line Chart'));
      userEvent.click(screen.getByText('Area Chart'));

      expect(screen.getByText('project')).toBeInTheDocument();
    });

    it('sends a top N request when a grouping is selected', async function () {
      renderTestComponent({
        query: {displayType: 'line'},
        orgFeatures: [...defaultOrgFeatures, 'new-widget-builder-experience-design'],
      });

      userEvent.click(await screen.findByText('Group your results'));
      userEvent.type(screen.getByText('Select group'), 'project{enter}');

      // TODO: This should change after adding a limit and sorting field
      expect(eventsStatsMock).toHaveBeenNthCalledWith(
        2,
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: '',
            yAxis: ['count()'],
            field: ['project', 'count()'],
            topEvents: TOP_N,
            orderby: 'project',
          }),
        })
      );
    });
  });
});
