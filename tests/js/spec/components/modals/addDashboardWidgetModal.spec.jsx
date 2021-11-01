import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {getOptionByLabel, openMenu, selectByLabel} from 'sentry-test/select-new';

import AddDashboardWidgetModal from 'app/components/modals/addDashboardWidgetModal';
import {t} from 'app/locale';
import TagStore from 'app/stores/tagStore';
import * as types from 'app/views/dashboardsV2/types';

const stubEl = props => <div>{props.children}</div>;

function mountModal({
  initialData,
  onAddWidget,
  onUpdateWidget,
  widget,
  fromDiscover,
  defaultWidgetQuery,
  displayType,
}) {
  return mountWithTheme(
    <AddDashboardWidgetModal
      Header={stubEl}
      Footer={stubEl}
      Body={stubEl}
      organization={initialData.organization}
      onAddWidget={onAddWidget}
      onUpdateWidget={onUpdateWidget}
      widget={widget}
      closeModal={() => void 0}
      fromDiscover={fromDiscover}
      defaultWidgetQuery={defaultWidgetQuery}
      displayType={displayType}
    />,
    initialData.routerContext
  );
}

async function clickSubmit(wrapper) {
  // Click on submit.
  const button = wrapper.find('Button[data-test-id="add-widget"] button');
  button.simulate('click');

  // Wait for xhr to complete.
  return tick();
}

function getDisplayType(wrapper) {
  return wrapper.find('input[name="displayType"]');
}

function selectDashboard(wrapper, dashboard) {
  const input = wrapper.find('SelectControl[name="dashboard"]');
  input.props().onChange(dashboard);
}

async function setSearchConditions(el, query) {
  el.find('textarea')
    .simulate('change', {target: {value: query}})
    .getDOMNode()
    .setSelectionRange(query.length, query.length);

  await tick();
  await el.update();

  el.find('textarea').simulate('keydown', {key: 'Enter'});
}

describe('Modals -> AddDashboardWidgetModal', function () {
  const initialData = initializeOrg({
    organization: {
      features: ['performance-view', 'discover-query'],
      apdexThreshold: 400,
    },
  });
  const tags = [
    {name: 'browser.name', key: 'browser.name'},
    {name: 'custom-field', key: 'custom-field'},
  ];

  let eventsStatsMock;

  beforeEach(function () {
    TagStore.onLoadTagsSuccess(tags);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/widgets/',
      method: 'POST',
      statusCode: 200,
      body: [],
    });
    eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {data: [{'event.type': 'error'}], meta: {'event.type': 'string'}},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-geo/',
      body: {data: [], meta: {}},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [
        TestStubs.Dashboard([], {
          id: '1',
          title: 'Test Dashboard',
          widgetDisplay: ['area'],
        }),
      ],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('redirects correctly when creating a new dashboard', async function () {
    const wrapper = mountModal({initialData, fromDiscover: true});
    // @ts-expect-error
    await tick();
    await wrapper.update();
    selectDashboard(wrapper, {label: t('+ Create New Dashboard'), value: 'new'});
    await clickSubmit(wrapper);
    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/dashboards/new/',
      })
    );
    wrapper.unmount();
  });

  it('redirects correctly when choosing an existing dashboard', async function () {
    const wrapper = mountModal({initialData, fromDiscover: true});
    // @ts-expect-error
    await tick();
    await wrapper.update();
    selectDashboard(wrapper, {label: t('Test Dashboard'), value: '1'});
    await clickSubmit(wrapper);
    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/dashboard/1/',
      })
    );
    wrapper.unmount();
  });

  it('disables dashboards with max widgets', async function () {
    types.MAX_WIDGETS = 1;
    const wrapper = mountModal({initialData, fromDiscover: true});
    // @ts-expect-error
    await tick();
    await wrapper.update();
    openMenu(wrapper, {name: 'dashboard', control: true});

    const input = wrapper.find('SelectControl[name="dashboard"]');
    expect(input.find('Option Option')).toHaveLength(2);
    expect(input.find('Option Option').at(0).props().isDisabled).toBe(false);
    expect(input.find('Option Option').at(1).props().isDisabled).toBe(true);

    wrapper.unmount();
  });

  it('can update the title', async function () {
    let widget = undefined;
    const wrapper = mountModal({
      initialData,
      onAddWidget: data => (widget = data),
    });
    const input = wrapper.find('Input[name="title"] input');
    input.simulate('change', {target: {value: 'Unique Users'}});

    await clickSubmit(wrapper);

    expect(widget.title).toEqual('Unique Users');
    wrapper.unmount();
  });

  it('can add conditions', async function () {
    jest.useFakeTimers();
    let widget = undefined;
    const wrapper = mountModal({
      initialData,
      onAddWidget: data => (widget = data),
    });
    // Change the search text on the first query.
    const input = wrapper.find('#smart-search-input').first();
    input.simulate('change', {target: {value: 'color:blue'}}).simulate('blur');

    jest.runAllTimers();
    jest.useRealTimers();

    await clickSubmit(wrapper);

    expect(widget.queries).toHaveLength(1);
    expect(widget.queries[0].conditions).toEqual('color:blue');
    wrapper.unmount();
  });

  it('can choose a field', async function () {
    let widget = undefined;
    const wrapper = mountModal({
      initialData,
      onAddWidget: data => (widget = data),
    });
    // No delete button as there is only one field.
    expect(wrapper.find('IconDelete')).toHaveLength(0);

    selectByLabel(wrapper, 'p95(\u2026)', {name: 'field', at: 0, control: true});

    await clickSubmit(wrapper);

    expect(widget.queries).toHaveLength(1);
    expect(widget.queries[0].fields).toEqual(['p95(transaction.duration)']);
    wrapper.unmount();
  });

  it('can add additional fields', async function () {
    let widget = undefined;
    const wrapper = mountModal({
      initialData,
      onAddWidget: data => (widget = data),
    });

    // Click the add button
    const add = wrapper.find('button[aria-label="Add Overlay"]');
    add.simulate('click');
    wrapper.update();

    // Should be another field input.
    expect(wrapper.find('QueryField')).toHaveLength(2);

    selectByLabel(wrapper, 'p95(\u2026)', {name: 'field', at: 1, control: true});

    await clickSubmit(wrapper);

    expect(widget.queries).toHaveLength(1);
    expect(widget.queries[0].fields).toEqual(['count()', 'p95(transaction.duration)']);
    wrapper.unmount();
  });

  it('can add equation fields', async function () {
    let widget = undefined;
    const wrapper = mountModal({
      initialData,
      onAddWidget: data => (widget = data),
    });

    // Click the add button
    const add = wrapper.find('button[aria-label="Add an Equation"]');
    add.simulate('click');
    wrapper.update();

    // Should be another field input.
    expect(wrapper.find('QueryField')).toHaveLength(2);

    expect(wrapper.find('ArithmeticInput')).toHaveLength(1);

    wrapper
      .find('QueryFieldWrapper input[name="arithmetic"]')
      .simulate('change', {target: {value: 'count() + 100'}})
      .simulate('blur');

    wrapper.update();

    await clickSubmit(wrapper);

    expect(widget.queries).toHaveLength(1);
    expect(widget.queries[0].fields).toEqual(['count()', 'equation|count() + 100']);
    wrapper.unmount();
  });

  it('additional fields get added to new seach filters', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });

    let widget = undefined;
    const wrapper = mountModal({
      initialData,
      onAddWidget: data => (widget = data),
    });

    // Click the add button
    const add = wrapper.find('button[aria-label="Add Overlay"]');
    add.simulate('click');
    wrapper.update();

    // Should be another field input.
    expect(wrapper.find('QueryField')).toHaveLength(2);

    selectByLabel(wrapper, 'p95(\u2026)', {name: 'field', at: 1, control: true});

    await clickSubmit(wrapper);

    expect(widget.queries).toHaveLength(1);
    expect(widget.queries[0].fields).toEqual(['count()', 'p95(transaction.duration)']);

    // Add another search filter
    const addQuery = wrapper.find('button[aria-label="Add Query"]');
    addQuery.simulate('click');
    wrapper.update();
    // Set second query search conditions
    const secondSearchBar = wrapper.find('SearchConditionsWrapper StyledSearchBar').at(1);
    await setSearchConditions(secondSearchBar, 'event.type:error');

    // Set second query legend alias
    wrapper
      .find('SearchConditionsWrapper input[placeholder="Legend Alias"]')
      .at(1)
      .simulate('change', {target: {value: 'Errors'}});

    // Save widget
    await clickSubmit(wrapper);

    expect(widget.queries[0]).toMatchObject({
      name: '',
      conditions: '',
      fields: ['count()', 'p95(transaction.duration)'],
    });
    expect(widget.queries[1]).toMatchObject({
      name: 'Errors',
      conditions: 'event.type:error',
      fields: ['count()', 'p95(transaction.duration)'],
    });

    wrapper.unmount();
  });

  it('can add and delete additional queries', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/event.type/values/',
      body: [{count: 2, name: 'Nvidia 1080ti'}],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });

    let widget = undefined;
    const wrapper = mountModal({
      initialData,
      onAddWidget: data => (widget = data),
    });

    // Set first query search conditions
    await setSearchConditions(
      wrapper.find('SearchConditionsWrapper StyledSearchBar'),
      'event.type:transaction'
    );

    // Set first query legend alias
    wrapper
      .find('SearchConditionsWrapper input[placeholder="Legend Alias"]')
      .simulate('change', {target: {value: 'Transactions'}});

    // Click the "Add Query" button twice
    const addQuery = wrapper.find('button[aria-label="Add Query"]');
    addQuery.simulate('click');
    wrapper.update();
    addQuery.simulate('click');
    wrapper.update();

    // Expect three search bars
    expect(wrapper.find('StyledSearchBar')).toHaveLength(3);

    // Expect "Add Query" button to be hidden since we're limited to at most 3 search conditions
    expect(wrapper.find('button[aria-label="Add Query"]')).toHaveLength(0);

    // Delete second query
    expect(wrapper.find('button[aria-label="Remove query"]')).toHaveLength(3);
    wrapper.find('button[aria-label="Remove query"]').at(1).simulate('click');
    wrapper.update();

    // Expect "Add Query" button to be shown again
    expect(wrapper.find('button[aria-label="Add Query"]')).toHaveLength(1);

    // Set second query search conditions
    const secondSearchBar = wrapper.find('SearchConditionsWrapper StyledSearchBar').at(1);
    await setSearchConditions(secondSearchBar, 'event.type:error');

    // Set second query legend alias
    wrapper
      .find('SearchConditionsWrapper input[placeholder="Legend Alias"]')
      .at(1)
      .simulate('change', {target: {value: 'Errors'}});

    // Save widget
    await clickSubmit(wrapper);

    expect(widget.queries).toHaveLength(2);
    expect(widget.queries[0]).toMatchObject({
      name: 'Transactions',
      conditions: 'event.type:transaction',
      fields: ['count()'],
    });
    expect(widget.queries[1]).toMatchObject({
      name: 'Errors',
      conditions: 'event.type:error',
      fields: ['count()'],
    });
    wrapper.unmount();
  });

  it('can respond to validation feedback', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/widgets/',
      method: 'POST',
      statusCode: 400,
      body: {
        title: ['This field is required'],
        queries: [{conditions: ['Invalid value']}],
      },
    });

    let widget = undefined;
    const wrapper = mountModal({
      initialData,
      onAddWidget: data => (widget = data),
    });

    await clickSubmit(wrapper);
    await wrapper.update();

    // API request should fail and not add widget.
    expect(widget).toBeUndefined();

    const errors = wrapper.find('FieldErrorReason');
    expect(errors).toHaveLength(2);

    // Nested object error should display
    const conditionError = wrapper.find('WidgetQueriesForm FieldErrorReason');
    expect(conditionError).toHaveLength(1);
    wrapper.unmount();
  });

  it('can edit a widget', async function () {
    let widget = {
      id: '9',
      title: 'Errors over time',
      interval: '5m',
      displayType: 'line',
      queries: [
        {
          id: '9',
          name: 'errors',
          conditions: 'event.type:error',
          fields: ['count()', 'count_unique(id)'],
        },
        {
          id: '9',
          name: 'csp',
          conditions: 'event.type:csp',
          fields: ['count()', 'count_unique(id)'],
        },
      ],
    };
    const onAdd = jest.fn();
    const wrapper = mountModal({
      initialData,
      widget,
      onAddWidget: onAdd,
      onUpdateWidget: data => {
        widget = data;
      },
    });

    // Should be in edit 'mode'
    const heading = wrapper.find('h4');
    expect(heading.text()).toContain('Edit');

    // Should set widget data up.
    const title = wrapper.find('Input[name="title"]');
    expect(title.props().value).toEqual(widget.title);
    expect(wrapper.find('input[name="displayType"]').props().value).toEqual(
      widget.displayType
    );
    expect(wrapper.find('WidgetQueriesForm')).toHaveLength(1);
    expect(wrapper.find('StyledSearchBar')).toHaveLength(2);
    expect(wrapper.find('QueryField')).toHaveLength(2);

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

    title.simulate('change', {target: {value: 'New title'}});
    await clickSubmit(wrapper);

    expect(onAdd).not.toHaveBeenCalled();
    expect(widget.title).toEqual('New title');

    expect(eventsStatsMock).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it('renders column inputs for table widgets', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      method: 'GET',
      statusCode: 200,
      body: {
        meta: {},
        data: [],
      },
    });

    let widget = {
      id: '9',
      title: 'sdk usage',
      interval: '5m',
      displayType: 'table',
      queries: [
        {
          id: '9',
          name: 'errors',
          conditions: 'event.type:error',
          fields: ['sdk.name', 'count()'],
        },
      ],
    };
    const wrapper = mountModal({
      initialData,
      widget,
      onAddWidget: jest.fn(),
      onUpdateWidget: data => {
        widget = data;
      },
    });

    // Should be in edit 'mode'
    const heading = wrapper.find('h4').first();
    expect(heading.text()).toContain('Edit');

    // Should set widget data up.
    const title = wrapper.find('Input[name="title"]');
    expect(title.props().value).toEqual(widget.title);
    expect(wrapper.find('input[name="displayType"]').props().value).toEqual(
      widget.displayType
    );
    expect(wrapper.find('WidgetQueriesForm')).toHaveLength(1);
    // Should have an orderby select
    expect(wrapper.find('WidgetQueriesForm SelectControl[name="orderby"]')).toHaveLength(
      1
    );

    // Add a column, and choose a value,
    wrapper.find('button[aria-label="Add a Column"]').simulate('click');
    await wrapper.update();

    selectByLabel(wrapper, 'trace', {name: 'field', at: 2, control: true});
    await wrapper.update();

    await clickSubmit(wrapper);

    // A new field should be added.
    expect(widget.queries[0].fields).toHaveLength(3);
    expect(widget.queries[0].fields[2]).toEqual('trace');
    wrapper.unmount();
  });

  it('uses count() columns if there are no aggregate fields remaining when switching from table to chart', async function () {
    let widget = undefined;
    const wrapper = mountModal({
      initialData,
      onAddWidget: data => (widget = data),
    });
    // No delete button as there is only one field.
    expect(wrapper.find('IconDelete')).toHaveLength(0);

    // Select Table display
    selectByLabel(wrapper, 'Table', {name: 'displayType', at: 0, control: true});
    expect(getDisplayType(wrapper).props().value).toEqual('table');

    // Add field column
    selectByLabel(wrapper, 'event.type', {name: 'field', at: 0, control: true});
    let fieldColumn = wrapper.find('input[name="field"]');
    expect(fieldColumn.props().value).toEqual({
      kind: 'field',
      meta: {dataType: 'string', name: 'event.type'},
    });

    // Select Line chart display
    selectByLabel(wrapper, 'Line Chart', {name: 'displayType', at: 0, control: true});
    expect(getDisplayType(wrapper).props().value).toEqual('line');

    // Expect event.type field to be converted to count()
    fieldColumn = wrapper.find('input[name="field"]');
    expect(fieldColumn.props().value).toEqual({
      kind: 'function',
      meta: {name: 'count', parameters: []},
    });

    await clickSubmit(wrapper);

    expect(widget.queries).toHaveLength(1);
    expect(widget.queries[0].fields).toEqual(['count()']);
    wrapper.unmount();
  });

  it('should filter out non-aggregate fields when switching from table to chart', async function () {
    let widget = undefined;
    const wrapper = mountModal({
      initialData,
      onAddWidget: data => (widget = data),
    });
    // No delete button as there is only one field.
    expect(wrapper.find('IconDelete')).toHaveLength(0);

    // Select Table display
    selectByLabel(wrapper, 'Table', {name: 'displayType', at: 0, control: true});
    expect(getDisplayType(wrapper).props().value).toEqual('table');

    // Click the add button
    const add = wrapper.find('button[aria-label="Add a Column"]');
    add.simulate('click');
    wrapper.update();

    // Add columns
    selectByLabel(wrapper, 'event.type', {name: 'field', at: 0, control: true});
    let fieldColumn = wrapper.find('input[name="field"]').at(0);
    expect(fieldColumn.props().value).toEqual({
      kind: 'field',
      meta: {dataType: 'string', name: 'event.type'},
    });

    selectByLabel(wrapper, 'p95(\u2026)', {name: 'field', at: 1, control: true});
    fieldColumn = wrapper.find('input[name="field"]').at(1);
    expect(fieldColumn.props().value).toMatchObject({
      kind: 'function',
      meta: {
        name: 'p95',
        parameters: [{defaultValue: 'transaction.duration', kind: 'column'}],
      },
    });

    // Select Line chart display
    selectByLabel(wrapper, 'Line Chart', {name: 'displayType', at: 0, control: true});
    expect(getDisplayType(wrapper).props().value).toEqual('line');

    // Expect event.type field to be converted to count()
    fieldColumn = wrapper.find('input[name="field"]');
    expect(fieldColumn.length).toEqual(1);
    expect(fieldColumn.props().value).toMatchObject({
      kind: 'function',
      meta: {
        name: 'p95',
        parameters: [{defaultValue: 'transaction.duration', kind: 'column'}],
      },
    });

    await clickSubmit(wrapper);

    expect(widget.queries).toHaveLength(1);
    expect(widget.queries[0].fields).toEqual(['p95(transaction.duration)']);
    wrapper.unmount();
  });

  it('should filter non-legal y-axis choices for timeseries widget charts', async function () {
    let widget = undefined;
    const wrapper = mountModal({
      initialData,
      onAddWidget: data => (widget = data),
    });
    // No delete button as there is only one field.
    expect(wrapper.find('IconDelete')).toHaveLength(0);

    selectByLabel(wrapper, 'any(\u2026)', {
      name: 'field',
      at: 0,
      control: true,
    });

    // Expect user.display to not be an available parameter option for any()
    // for line (timeseries) widget charts
    const option = getOptionByLabel(wrapper, 'user.display', {
      name: 'parameter',
      at: 0,
      control: true,
    });
    expect(option.exists()).toEqual(false);

    // Be able to choose a numeric-like option for any()
    selectByLabel(wrapper, 'measurements.lcp', {
      name: 'parameter',
      at: 0,
      control: true,
    });

    await clickSubmit(wrapper);

    expect(widget.displayType).toEqual('line');
    expect(widget.queries).toHaveLength(1);
    expect(widget.queries[0].fields).toEqual(['any(measurements.lcp)']);
    wrapper.unmount();
  });

  it('should not filter y-axis choices for big number widget charts', async function () {
    let widget = undefined;
    const wrapper = mountModal({
      initialData,
      onAddWidget: data => (widget = data),
    });
    // No delete button as there is only one field.
    expect(wrapper.find('IconDelete')).toHaveLength(0);

    // Select Big number display
    selectByLabel(wrapper, 'Big Number', {name: 'displayType', at: 0, control: true});
    expect(getDisplayType(wrapper).props().value).toEqual('big_number');

    selectByLabel(wrapper, 'count_unique(\u2026)', {
      name: 'field',
      at: 0,
      control: true,
    });

    // Be able to choose a non numeric-like option for count_unique()
    selectByLabel(wrapper, 'user.display', {
      name: 'parameter',
      at: 0,
      control: true,
    });

    await clickSubmit(wrapper);

    expect(widget.displayType).toEqual('big_number');
    expect(widget.queries).toHaveLength(1);
    expect(widget.queries[0].fields).toEqual(['count_unique(user.display)']);
    wrapper.unmount();
  });

  it('should filter y-axis choices for world map widget charts', async function () {
    let widget = undefined;
    const wrapper = mountModal({
      initialData,
      onAddWidget: data => (widget = data),
    });
    // No delete button as there is only one field.
    expect(wrapper.find('IconDelete')).toHaveLength(0);

    // Select World Map display
    selectByLabel(wrapper, 'World Map', {name: 'displayType', at: 0, control: true});
    expect(getDisplayType(wrapper).props().value).toEqual('world_map');

    // Choose any()
    selectByLabel(wrapper, 'any(\u2026)', {
      name: 'field',
      at: 0,
      control: true,
    });

    // user.display should be filtered out for any()
    const option = getOptionByLabel(wrapper, 'user.display', {
      name: 'parameter',
      at: 0,
      control: true,
    });
    expect(option.exists()).toEqual(false);

    selectByLabel(wrapper, 'measurements.lcp', {
      name: 'parameter',
      at: 0,
      control: true,
    });

    // Choose count_unique()
    selectByLabel(wrapper, 'count_unique(\u2026)', {
      name: 'field',
      at: 0,
      control: true,
    });

    // user.display not should be filtered out for count_unique()
    selectByLabel(wrapper, 'user.display', {
      name: 'parameter',
      at: 0,
      control: true,
    });

    // Be able to choose a numeric-like option
    selectByLabel(wrapper, 'measurements.lcp', {
      name: 'parameter',
      at: 0,
      control: true,
    });

    await clickSubmit(wrapper);

    expect(widget.displayType).toEqual('world_map');
    expect(widget.queries).toHaveLength(1);
    expect(widget.queries[0].fields).toEqual(['count_unique(measurements.lcp)']);
    wrapper.unmount();
  });

  it('should filter y-axis choices by output type when switching from big number to line chart', async function () {
    let widget = undefined;
    const wrapper = mountModal({
      initialData,
      onAddWidget: data => (widget = data),
    });
    // No delete button as there is only one field.
    expect(wrapper.find('IconDelete')).toHaveLength(0);

    // Select Big Number display
    selectByLabel(wrapper, 'Big Number', {name: 'displayType', at: 0, control: true});
    expect(getDisplayType(wrapper).props().value).toEqual('big_number');

    // Choose any()
    selectByLabel(wrapper, 'any(\u2026)', {
      name: 'field',
      at: 0,
      control: true,
    });

    selectByLabel(wrapper, 'id', {
      name: 'parameter',
      at: 0,
      control: true,
    });

    // Select Line chart display
    selectByLabel(wrapper, 'Line Chart', {name: 'displayType', at: 0, control: true});
    expect(getDisplayType(wrapper).props().value).toEqual('line');

    // Expect event.type field to be converted to count()
    const fieldColumn = wrapper.find('input[name="field"]');
    expect(fieldColumn.length).toEqual(1);
    expect(fieldColumn.props().value).toMatchObject({
      kind: 'function',
      meta: {
        name: 'count',
        parameters: [],
      },
    });

    await clickSubmit(wrapper);

    expect(widget.displayType).toEqual('line');
    expect(widget.queries).toHaveLength(1);
    expect(widget.queries[0].fields).toEqual(['count()']);
    wrapper.unmount();
  });

  it('should automatically add columns for top n widget charts', async function () {
    const wrapper = mountModal({
      initialData,
      onAddWidget: data => (widget = data),
    });
    // Select Top n display
    selectByLabel(wrapper, 'Top Events', {name: 'displayType', at: 0, control: true});
    expect(getDisplayType(wrapper).props().value).toEqual('top_n');

    // No delete button as there is only one field.
    expect(wrapper.find('IconDelete')).toHaveLength(0);

    // Restricting to a single query
    expect(wrapper.find('button[aria-label="Add Query"]')).toHaveLength(0);

    // Restricting to a single y-axis
    expect(wrapper.find('button[aria-label="Add Overlay"]')).toHaveLength(0);

    const titleColumn = wrapper.find('input[name="field"]').at(0);
    expect(titleColumn.props().value).toEqual({
      kind: 'field',
      meta: {dataType: 'string', name: 'title'},
    });
    const countColumn = wrapper.find('input[name="field"]').at(1);
    expect(countColumn.props().value).toEqual({
      kind: 'function',
      meta: {parameters: [], name: 'count'},
    });
    expect(wrapper.find('WidgetQueriesForm Field[data-test-id="y-axis"]')).toHaveLength(
      1
    );
    expect(wrapper.find('WidgetQueriesForm SelectControl[name="orderby"]')).toHaveLength(
      1
    );

    wrapper.unmount();
  });

  it('should use defaultWidgetQuery Y-Axis and Conditions if given a defaultWidgetQuery', async function () {
    const wrapper = mountModal({
      initialData,
      onAddWidget: () => undefined,
      onUpdateWidget: () => undefined,
      widget: undefined,
      fromDiscover: true,
      defaultWidgetQuery: {
        name: '',
        fields: ['count()', 'failure_count()', 'count_unique(user)'],
        conditions: 'tag:value',
        orderby: '',
      },
    });

    expect(wrapper.find('SearchBar').props().query).toEqual('tag:value');
    const queryFields = wrapper.find('QueryField');
    expect(queryFields.length).toEqual(3);
    expect(queryFields.at(0).props().fieldValue.function[0]).toEqual('count');
    expect(queryFields.at(1).props().fieldValue.function[0]).toEqual('failure_count');
    expect(queryFields.at(2).props().fieldValue.function[0]).toEqual('count_unique');
    wrapper.unmount();
  });

  it('uses displayType if given a displayType', async function () {
    const wrapper = mountModal({
      initialData,
      onAddWidget: () => undefined,
      onUpdateWidget: () => undefined,
      fromDiscover: true,
      displayType: types.DisplayType.BAR,
    });

    expect(wrapper.find('SelectPicker').at(1).props().value.value).toEqual('bar');
    wrapper.unmount();
  });

  it('correctly defaults fields and orderby when in Top N display', async function () {
    const wrapper = mountModal({
      initialData,
      onAddWidget: () => undefined,
      onUpdateWidget: () => undefined,
      fromDiscover: true,
      displayType: types.DisplayType.TOP_N,
      defaultWidgetQuery: {fields: ['count_unique(user)'], orderby: '-count_unique_user'},
      defaultTableColumns: ['title', 'count()', 'count_unique(user)'],
    });

    expect(wrapper.find('SelectPicker').at(1).props().value.value).toEqual('top_n');
    expect(wrapper.find('WidgetQueriesForm').props().queries[0].fields).toEqual([
      'title',
      'count_unique(user)',
    ]);
    expect(wrapper.find('WidgetQueriesForm').props().queries[0].orderby).toEqual(
      '-count_unique_user'
    );
    wrapper.unmount();
  });
});
