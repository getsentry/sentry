import React from 'react';
import {urlEncode} from '@sentry/utils';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  mountWithTheme,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {
  DashboardDetails,
  DashboardWidgetSource,
  DisplayType,
  Widget,
} from 'sentry/views/dashboardsV2/types';
import * as dashboardsTypes from 'sentry/views/dashboardsV2/types';
import WidgetBuilder, {WidgetBuilderProps} from 'sentry/views/dashboardsV2/widgetBuilder';

function renderTestComponent({
  widget,
  dashboard,
  query,
  orgFeatures,
  onSave,
}: {
  dashboard?: WidgetBuilderProps['dashboard'];
  onSave?: WidgetBuilderProps['onSave'];
  orgFeatures?: string[];
  query?: Record<string, any>;
  widget?: WidgetBuilderProps['widget'];
} = {}) {
  const {organization, router, routerContext} = initializeOrg({
    ...initializeOrg(),
    organization: {
      features: orgFeatures ?? [
        'new-widget-builder-experience',
        'dashboards-edit',
        'global-views',
      ],
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

  mountWithTheme(
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
        widgetIndex: widget ? Number(widget.id) : undefined,
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
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
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
          conditions: '',
          orderby: '-time',
        },
        {
          name: 'Anonymous Users',
          fields: [],
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
      '/organizations/org-slug/dashboards/new/?source=dashboards'
    );
    expect(screen.getByText('Widget Builder')).toBeInTheDocument();

    // Header - Widget Title
    expect(screen.getByRole('heading', {name: 'Custom Widget'})).toBeInTheDocument();

    // Header - Actions
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add Widget'})).toBeInTheDocument();

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
    expect(screen.getByRole('heading', {name: 'Columns'})).toBeInTheDocument();

    // Content - Step 4
    expect(screen.getByRole('heading', {name: 'Query'})).toBeInTheDocument();

    // Content - Step 5
    expect(screen.getByRole('heading', {name: 'Sort by'})).toBeInTheDocument();
  });

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
            period: '24h',
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
            period: '24h',
            utc: false,
            project: [],
            environment: [],
          },
        })
      );
    });
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
    userEvent.type(
      screen.getByRole('textbox', {name: 'Widget title'}),
      'Unique Users{enter}'
    );

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
            period: '24h',
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
    expect(screen.queryByRole('button', {name: 'Remove query'})).not.toBeInTheDocument();

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
            period: '24h',
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
    userEvent.click(screen.getByRole('button', {name: 'Add Overlay'}));

    // Should be another field input.
    expect(screen.getAllByLabelText('Remove this Y-Axis')).toHaveLength(2);

    userEvent.click(screen.getByText('(Required)'));
    userEvent.type(screen.getByText('(Required)'), 'count_unique(…){enter}');

    userEvent.click(screen.getByRole('button', {name: 'Add Widget'}));

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
    userEvent.click(screen.getByRole('button', {name: 'Add an Equation'}));

    // Should be another field input.
    expect(screen.getAllByLabelText('Remove this Y-Axis')).toHaveLength(2);

    expect(screen.getByPlaceholderText('Equation')).toBeInTheDocument();

    userEvent.type(screen.getByPlaceholderText('Equation'), 'count() + 100');

    userEvent.click(screen.getByRole('button', {name: 'Add Widget'}));

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
              conditions: '',
              orderby: '',
            },
          ],
        }),
      ]);
    });

    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('additional fields get added to new seach filters', async function () {
    const handleSave = jest.fn();

    renderTestComponent({onSave: handleSave});

    userEvent.click(await screen.findByText('Table'));

    // Select line chart display
    userEvent.click(screen.getByText('Line Chart'));

    // Click the add overlay button
    userEvent.click(screen.getByRole('button', {name: 'Add Overlay'}));

    // Should be another field input.
    expect(screen.getAllByLabelText('Remove this Y-Axis')).toHaveLength(2);

    userEvent.click(screen.getByText('(Required)'));
    userEvent.type(screen.getByText('(Required)'), 'count_unique(…){enter}');

    // Add another search filter
    userEvent.click(screen.getByRole('button', {name: 'Add query'}));

    // Set second query search conditions
    userEvent.type(
      screen.getAllByLabelText('Search events')[1],
      'event.type:error{enter}'
    );

    // Set second query legend alias
    userEvent.type(screen.getAllByPlaceholderText('Legend Alias')[1], 'Errors');

    // Save widget
    userEvent.click(screen.getByRole('button', {name: 'Add Widget'}));

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
              fields: ['count()', 'count_unique(user)'],
              conditions: 'event.type:error',
              orderby: '',
            },
            {
              name: 'Errors',
              fields: ['count()', 'count_unique(user)'],
              conditions: '',
              orderby: '',
            },
          ],
        }),
      ]);
    });

    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it.only('can add and delete additional queries', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/event.type/values/',
      body: [{count: 2, name: 'Nvidia 1080ti'}],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });

    const handleSave = jest.fn();

    renderTestComponent({onSave: handleSave});

    userEvent.click(await screen.findByText('Table'));

    // Select line chart display
    userEvent.click(screen.getByText('Line Chart'));

    // Set first query search conditions
    userEvent.type(
      screen.getByPlaceholderText('Search for events, users, tags, and more'),
      'event.type:transaction{enter}'
    );

    // Set first query legend alias
    userEvent.type(screen.getByPlaceholderText('Legend Alias'), 'Transactions{enter}');

    // Click the "Add Query" button twice
    userEvent.click(screen.getByLabelText('Add query'));
    userEvent.click(screen.getByLabelText('Add query'));

    // Expect "Add Query" button to be hidden since we're limited to at most 3 search conditions
    expect(screen.queryByLabelText('Add query')).not.toBeInTheDocument();

    // Delete second query
    userEvent.click(screen.getAllByLabelText('Remove query')[1]);

    // Expect "Add Query" button to be shown again
    expect(screen.getByLabelText('Add query')).toBeInTheDocument();

    // Set second query search conditions
    userEvent.type(
      screen.getAllByPlaceholderText('Search for events, users, tags, and more')[1],
      'event.type:error{enter}'
    );

    // Set second query legend alias
    userEvent.type(screen.getAllByPlaceholderText('Legend Alias')[1], 'Errors{enter}');

    // Save widget
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
              fields: ['count()'],
              conditions: 'event.type:transaction',
              name: 'Transactions',
              orderby: '',
            },
            {
              fields: ['count()'],
              conditions: 'event.type:error',
              name: 'Errors',
              orderby: '',
            },
          ],
        }),
      ]);
    });

    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  // it('can respond to validation feedback', async function () {
  //   MockApiClient.addMockResponse({
  //     url: '/organizations/org-slug/dashboards/widgets/',
  //     method: 'POST',
  //     statusCode: 400,
  //     body: {
  //       title: ['This field is required'],
  //       queries: [{conditions: ['Invalid value']}],
  //     },
  //   });

  //   let widget = undefined;
  //   const wrapper = mountModal({
  //     initialData,
  //     onAddWidget: data => (widget = data),
  //   });

  //   await clickSubmit(wrapper);
  //   await wrapper.update();

  //   // API request should fail and not add widget.
  //   expect(widget).toBeUndefined();

  //   const errors = wrapper.find('FieldErrorReason');
  //   expect(errors).toHaveLength(2);

  //   // Nested object error should display
  //   const conditionError = wrapper.find('WidgetQueriesForm FieldErrorReason');
  //   expect(conditionError).toHaveLength(1);
  //   wrapper.unmount();
  // });

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
          orderby: '',
        },
        {
          name: 'csp',
          conditions: 'event.type:csp',
          fields: ['count()', 'count_unique(id)'],
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

  // it('renders column inputs for table widgets', async function () {
  //   MockApiClient.addMockResponse({
  //     url: '/organizations/org-slug/eventsv2/',
  //     method: 'GET',
  //     statusCode: 200,
  //     body: {
  //       meta: {},
  //       data: [],
  //     },
  //   });

  //   let widget = {
  //     id: '9',
  //     title: 'sdk usage',
  //     interval: '5m',
  //     displayType: 'table',
  //     queries: [
  //       {
  //         id: '9',
  //         name: 'errors',
  //         conditions: 'event.type:error',
  //         fields: ['sdk.name', 'count()'],
  //         orderby: '',
  //       },
  //     ],
  //   };
  //   const wrapper = mountModal({
  //     initialData,
  //     widget,
  //     onAddWidget: jest.fn(),
  //     onUpdateWidget: data => {
  //       widget = data;
  //     },
  //   });

  //   // Should be in edit 'mode'
  //   const heading = wrapper.find('h4').first();
  //   expect(heading.text()).toContain('Edit');

  //   // Should set widget data up.
  //   const title = wrapper.find('Input[name="title"]');
  //   expect(title.props().value).toEqual(widget.title);
  //   expect(wrapper.find('input[name="displayType"]').props().value).toEqual(
  //     widget.displayType
  //   );
  //   expect(wrapper.find('WidgetQueriesForm')).toHaveLength(1);
  //   // Should have an orderby select
  //   expect(wrapper.find('WidgetQueriesForm SelectControl[name="orderby"]')).toHaveLength(
  //     1
  //   );

  //   // Add a column, and choose a value,
  //   wrapper.find('button[aria-label="Add a Column"]').simulate('click');
  //   await wrapper.update();

  //   selectByLabel(wrapper, 'trace', {name: 'field', at: 2, control: true});
  //   await wrapper.update();

  //   await clickSubmit(wrapper);

  //   // A new field should be added.
  //   expect(widget.queries[0].fields).toHaveLength(3);
  //   expect(widget.queries[0].fields[2]).toEqual('trace');
  //   wrapper.unmount();
  // });

  // it('uses count() columns if there are no aggregate fields remaining when switching from table to chart', async function () {
  //   let widget = undefined;
  //   const wrapper = mountModal({
  //     initialData,
  //     onAddWidget: data => (widget = data),
  //   });
  //   // No delete button as there is only one field.
  //   expect(wrapper.find('IconDelete')).toHaveLength(0);

  //   // Select Table display
  //   selectByLabel(wrapper, 'Table', {name: 'displayType', at: 0, control: true});
  //   expect(getDisplayType(wrapper).props().value).toEqual('table');

  //   // Add field column
  //   selectByLabel(wrapper, 'event.type', {name: 'field', at: 0, control: true});

  //   let fieldColumn = wrapper.find('input[name="field"]');
  //   expect(fieldColumn.props().value).toEqual({
  //     kind: 'field',
  //     meta: {dataType: 'string', name: 'event.type'},
  //   });

  //   // Select Line chart display
  //   selectByLabel(wrapper, 'Line Chart', {name: 'displayType', at: 0, control: true});
  //   expect(getDisplayType(wrapper).props().value).toEqual('line');

  //   // Expect event.type field to be converted to count()
  //   fieldColumn = wrapper.find('input[name="field"]');
  //   expect(fieldColumn.props().value).toEqual({
  //     kind: 'function',
  //     meta: {name: 'count', parameters: []},
  //   });

  //   await clickSubmit(wrapper);

  //   expect(widget.queries).toHaveLength(1);
  //   expect(widget.queries[0].fields).toEqual(['count()']);
  //   wrapper.unmount();
  // });

  // it('should filter out non-aggregate fields when switching from table to chart', async function () {
  //   let widget = undefined;
  //   const wrapper = mountModal({
  //     initialData,
  //     onAddWidget: data => (widget = data),
  //   });
  //   // No delete button as there is only one field.
  //   expect(wrapper.find('IconDelete')).toHaveLength(0);

  //   // Select Table display
  //   selectByLabel(wrapper, 'Table', {name: 'displayType', at: 0, control: true});
  //   expect(getDisplayType(wrapper).props().value).toEqual('table');

  //   // Click the add button
  //   const add = wrapper.find('button[aria-label="Add a Column"]');
  //   add.simulate('click');
  //   wrapper.update();

  //   // Add columns
  //   selectByLabel(wrapper, 'event.type', {name: 'field', at: 0, control: true});
  //   let fieldColumn = wrapper.find('input[name="field"]').at(0);
  //   expect(fieldColumn.props().value).toEqual({
  //     kind: 'field',
  //     meta: {dataType: 'string', name: 'event.type'},
  //   });

  //   selectByLabel(wrapper, 'p95(\u2026)', {name: 'field', at: 1, control: true});
  //   fieldColumn = wrapper.find('input[name="field"]').at(1);
  //   expect(fieldColumn.props().value).toMatchObject({
  //     kind: 'function',
  //     meta: {
  //       name: 'p95',
  //       parameters: [{defaultValue: 'transaction.duration', kind: 'column'}],
  //     },
  //   });

  //   // Select Line chart display
  //   selectByLabel(wrapper, 'Line Chart', {name: 'displayType', at: 0, control: true});
  //   expect(getDisplayType(wrapper).props().value).toEqual('line');

  //   // Expect event.type field to be converted to count()
  //   fieldColumn = wrapper.find('input[name="field"]');
  //   expect(fieldColumn.length).toEqual(1);
  //   expect(fieldColumn.props().value).toMatchObject({
  //     kind: 'function',
  //     meta: {
  //       name: 'p95',
  //       parameters: [{defaultValue: 'transaction.duration', kind: 'column'}],
  //     },
  //   });

  //   await clickSubmit(wrapper);

  //   expect(widget.queries).toHaveLength(1);
  //   expect(widget.queries[0].fields).toEqual(['p95(transaction.duration)']);
  //   wrapper.unmount();
  // });

  // it('should filter non-legal y-axis choices for timeseries widget charts', async function () {
  //   let widget = undefined;
  //   const wrapper = mountModal({
  //     initialData,
  //     onAddWidget: data => (widget = data),
  //   });
  //   // Select Line chart display
  //   selectByLabel(wrapper, 'Line Chart', {name: 'displayType', at: 0, control: true});

  //   // No delete button as there is only one field.
  //   expect(wrapper.find('IconDelete')).toHaveLength(0);

  //   selectByLabel(wrapper, 'any(\u2026)', {
  //     name: 'field',
  //     at: 0,
  //     control: true,
  //   });

  //   // Expect user.display to not be an available parameter option for any()
  //   // for line (timeseries) widget charts
  //   const option = getOptionByLabel(wrapper, 'user.display', {
  //     name: 'parameter',
  //     at: 0,
  //     control: true,
  //   });
  //   expect(option.exists()).toEqual(false);

  //   // Be able to choose a numeric-like option for any()
  //   selectByLabel(wrapper, 'measurements.lcp', {
  //     name: 'parameter',
  //     at: 0,
  //     control: true,
  //   });

  //   await clickSubmit(wrapper);

  //   expect(widget.displayType).toEqual('line');
  //   expect(widget.queries).toHaveLength(1);
  //   expect(widget.queries[0].fields).toEqual(['any(measurements.lcp)']);
  //   wrapper.unmount();
  // });

  // it('should not filter y-axis choices for big number widget charts', async function () {
  //   let widget = undefined;
  //   const wrapper = mountModal({
  //     initialData,
  //     onAddWidget: data => (widget = data),
  //   });
  //   // No delete button as there is only one field.
  //   expect(wrapper.find('IconDelete')).toHaveLength(0);

  //   // Select Big number display
  //   selectByLabel(wrapper, 'Big Number', {name: 'displayType', at: 0, control: true});
  //   expect(getDisplayType(wrapper).props().value).toEqual('big_number');

  //   selectByLabel(wrapper, 'count_unique(\u2026)', {
  //     name: 'field',
  //     at: 0,
  //     control: true,
  //   });

  //   // Be able to choose a non numeric-like option for count_unique()
  //   selectByLabel(wrapper, 'user.display', {
  //     name: 'parameter',
  //     at: 0,
  //     control: true,
  //   });

  //   await clickSubmit(wrapper);

  //   expect(widget.displayType).toEqual('big_number');
  //   expect(widget.queries).toHaveLength(1);
  //   expect(widget.queries[0].fields).toEqual(['count_unique(user.display)']);
  //   wrapper.unmount();
  // });

  // it('should filter y-axis choices for world map widget charts', async function () {
  //   let widget = undefined;
  //   const wrapper = mountModal({
  //     initialData,
  //     onAddWidget: data => (widget = data),
  //   });
  //   // No delete button as there is only one field.
  //   expect(wrapper.find('IconDelete')).toHaveLength(0);

  //   // Select World Map display
  //   selectByLabel(wrapper, 'World Map', {name: 'displayType', at: 0, control: true});
  //   expect(getDisplayType(wrapper).props().value).toEqual('world_map');

  //   // Choose any()
  //   selectByLabel(wrapper, 'any(\u2026)', {
  //     name: 'field',
  //     at: 0,
  //     control: true,
  //   });

  //   // user.display should be filtered out for any()
  //   const option = getOptionByLabel(wrapper, 'user.display', {
  //     name: 'parameter',
  //     at: 0,
  //     control: true,
  //   });
  //   expect(option.exists()).toEqual(false);

  //   selectByLabel(wrapper, 'measurements.lcp', {
  //     name: 'parameter',
  //     at: 0,
  //     control: true,
  //   });

  //   // Choose count_unique()
  //   selectByLabel(wrapper, 'count_unique(\u2026)', {
  //     name: 'field',
  //     at: 0,
  //     control: true,
  //   });

  //   // user.display not should be filtered out for count_unique()
  //   selectByLabel(wrapper, 'user.display', {
  //     name: 'parameter',
  //     at: 0,
  //     control: true,
  //   });

  //   // Be able to choose a numeric-like option
  //   selectByLabel(wrapper, 'measurements.lcp', {
  //     name: 'parameter',
  //     at: 0,
  //     control: true,
  //   });

  //   await clickSubmit(wrapper);

  //   expect(widget.displayType).toEqual('world_map');
  //   expect(widget.queries).toHaveLength(1);
  //   expect(widget.queries[0].fields).toEqual(['count_unique(measurements.lcp)']);
  //   wrapper.unmount();
  // });

  // it.only('should filter y-axis choices by output type when switching from big number to line chart', async function () {
  //   renderTestComponent();

  //   // No delete button as there is only one field.
  //   expect(screen.queryByRole('button', {name: 'Remove query'})).not.toBeInTheDocument();

  //   // Select Big Number display
  //   userEvent.click(await screen.findByText('Table'));
  //   userEvent.click(screen.getByText('Big Number'));

  //   // // Choose any()
  //   userEvent.click(screen.getByText('count()'));
  //   userEvent.type(screen.getAllByText('count()')[0], 'any(…){enter}');
  //   userEvent.click(screen.getByText('transaction.duration'));
  //   userEvent.type(screen.getAllByText('transaction.duration')[0], 'device.arch{enter}');

  //   // Select Line chart display
  //   userEvent.click(screen.getByText('Big Number'));
  //   userEvent.click(screen.getByText('Bar Chart'));

  //   // Expect event.type field to be converted to count()
  //   // const fieldColumn = wrapper.find('input[name="field"]');
  //   // expect(fieldColumn.length).toEqual(1);
  //   // expect(fieldColumn.props().value).toMatchObject({
  //   //   kind: 'function',
  //   //   meta: {
  //   //     name: 'count',
  //   //     parameters: [],
  //   //   },
  //   // });

  //   // await clickSubmit(wrapper);

  //   // expect(widget.displayType).toEqual('line');
  //   // expect(widget.queries).toHaveLength(1);
  //   // expect(widget.queries[0].fields).toEqual(['count()']);
  //   // wrapper.unmount();
  // });

  it('should automatically add columns for top n widget charts', async function () {
    const defaultWidgetQuery = {
      name: '',
      fields: ['title', 'count()', 'count_unique(user)', 'epm()', 'count()'],
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
    expect(screen.queryByRole('button', {name: 'Remove query'})).not.toBeInTheDocument();

    // Restricting to a single query
    expect(screen.queryByRole('button', {name: 'Add query'})).not.toBeInTheDocument();

    // // Restricting to a single y-axis
    expect(screen.queryByRole('button', {name: 'Add Overlay'})).not.toBeInTheDocument();

    expect(screen.getByText('Choose your y-axis')).toBeInTheDocument();

    expect(screen.getByText('Sort by')).toBeInTheDocument();

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getAllByText('count()')).toHaveLength(2);
    expect(screen.getByText('count_unique(…)')).toBeInTheDocument();
    expect(screen.getByText('user')).toBeInTheDocument();
  });

  it('should use defaultWidgetQuery Y-Axis and Conditions if given a defaultWidgetQuery', async function () {
    const defaultWidgetQuery = {
      name: '',
      fields: ['count()', 'failure_count()', 'count_unique(user)'],
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

    expect(screen.getAllByText('count()')).toHaveLength(2);
    expect(screen.getAllByText('failure_count()')).toHaveLength(2);
    expect(screen.getAllByText(/count_unique/)).toHaveLength(2);
    expect(screen.getByText('count_unique(user)')).toBeInTheDocument();
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

    // Sort by
    expect(screen.getByText('Sort by')).toBeInTheDocument();
    expect(screen.getByText('count_unique(user) desc')).toBeInTheDocument();
  });

  // it('submits custom widget correctly', async function () {
  //   const onAddLibraryWidgetMock = jest.fn();
  //   const wrapper = mountModal({
  //     initialData,
  //     dashboard,
  //     onAddLibraryWidget: onAddLibraryWidgetMock,
  //     source: types.DashboardWidgetSource.LIBRARY,
  //   });

  //   const input = wrapper.find('Input[name="title"] input');
  //   input.simulate('change', {target: {value: 'All Events'}});

  //   await clickSubmit(wrapper);
  //   expect(onAddLibraryWidgetMock).toHaveBeenCalledTimes(1);
  //   wrapper.unmount();
  // });

  it('limits TopN display to one query when switching from another visualization', async () => {
    renderTestComponent();

    userEvent.click(await screen.findByText('Table'));
    userEvent.click(screen.getByText('Bar Chart'));
    userEvent.click(screen.getByRole('button', {name: 'Add query'}));
    userEvent.click(screen.getByRole('button', {name: 'Add query'}));
    expect(
      screen.getAllByPlaceholderText('Search for events, users, tags, and more')
    ).toHaveLength(3);
    userEvent.click(screen.getByText('Bar Chart'));
    userEvent.click(await screen.findByText('Top 5 Events'));
    expect(
      screen.getByPlaceholderText('Search for events, users, tags, and more')
    ).toBeInTheDocument();
  });

  describe('Issue Widgets', function () {
    it('sets widgetType to issues', async function () {
      const handleSave = jest.fn();

      renderTestComponent({onSave: handleSave});

      userEvent.click(await screen.findByText('Issues (States, Assignment, Time, etc.)'));
      userEvent.click(screen.getByRole('button', {name: 'Add Widget'}));

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
                name: '',
                orderby: '',
              },
            ],
          }),
        ]);
      });

      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    it('render issues data set disabled', async function () {
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
      expect(screen.getAllByRole('button', {name: 'Remove column'})).toHaveLength(2);
      expect(screen.getAllByRole('button', {name: 'Drag to reorder'})).toHaveLength(3);

      userEvent.click(screen.getAllByRole('button', {name: 'Remove column'})[1]);
      userEvent.click(screen.getAllByRole('button', {name: 'Remove column'})[0]);

      expect(screen.getByText('issue')).toBeInTheDocument();
      expect(screen.queryByText('assignee')).not.toBeInTheDocument();
      expect(screen.queryByText('title')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Remove column'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Drag to reorder'})
      ).not.toBeInTheDocument();
    });
  });

  describe('Widget Library', function () {
    it('renders', async function () {
      renderTestComponent();
      expect(await screen.findByText('Widget Library')).toBeInTheDocument();
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
  });
});
