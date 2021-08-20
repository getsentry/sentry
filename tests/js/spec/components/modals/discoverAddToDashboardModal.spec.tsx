import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {getOptionByLabel, selectByLabel} from 'sentry-test/select-new';

import DiscoverAddToDashboardModal from 'app/components/modals/discoverAddToDashboardModal';
import {t} from 'app/locale';

const stubEl = props => <div>{props.children}</div>;
const styledStubEl = styled(stubEl)();

function mountModal({initialData}) {
  return mountWithTheme(
    <DiscoverAddToDashboardModal
      Header={stubEl}
      Footer={styledStubEl}
      Body={styledStubEl}
      CloseButton={stubEl}
      organization={initialData.organization}
      closeModal={() => void 0}
    />,
    initialData.routerContext
  );
}

async function clickSubmit(wrapper) {
  // Click on submit.
  const button = wrapper.find('Button[data-test-id="add-widget"] button');
  button.simulate('click');

  // Wait for xhr to complete.
  // @ts-expect-error
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

  // @ts-expect-error
  await tick();
  await el.update();

  el.find('textarea').simulate('keydown', {key: 'Enter'});
}

describe('Modals -> DiscoverAddToDashboardModal', function () {
  const initialData = initializeOrg({
    organization: {
      features: ['performance-view', 'discover-query'],
      apdexThreshold: 400,
    },
    project: undefined,
    projects: undefined,
    router: undefined,
  });

  beforeEach(function () {
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/widgets/',
      method: 'POST',
      statusCode: 200,
      body: [],
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {data: [{'event.type': 'error'}], meta: {'event.type': 'string'}},
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [{id: '1', title: t('Test Dashboard')}],
    });
    // @ts-expect-error
    browserHistory.push.mockReset();
  });

  afterEach(() => {
    // @ts-expect-error
    MockApiClient.clearMockResponses();
  });

  it('redirects correctly when creating a new dashboard', async function () {
    const wrapper = mountModal({initialData});
    // @ts-expect-error
    await tick();
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
    const wrapper = mountModal({initialData});
    // @ts-expect-error
    await tick();
    selectDashboard(wrapper, {label: t('Test Dashboard'), value: '1'});
    await clickSubmit(wrapper);
    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/dashboard/1/',
      })
    );
    wrapper.unmount();
  });

  it('can update the title', async function () {
    const wrapper = mountModal({initialData});
    // @ts-expect-error
    await tick();
    selectDashboard(wrapper, {label: t('+ Create New Dashboard'), value: 'new'});
    const input = wrapper.find('Input[name="title"] input');
    input.simulate('change', {target: {value: 'Unique Users'}});
    await clickSubmit(wrapper);
    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/dashboards/new/',
        query: expect.objectContaining({title: 'Unique Users'}),
      })
    );
    wrapper.unmount();
  });

  it('can choose a field', async function () {
    const wrapper = mountModal({initialData});
    // @ts-expect-error
    await tick();
    selectDashboard(wrapper, {label: t('+ Create New Dashboard'), value: 'new'});

    // No delete button as there is only one field.
    expect(wrapper.find('IconDelete')).toHaveLength(0);
    selectByLabel(wrapper, 'p95(\u2026)', {name: 'field', at: 0, control: true});
    await clickSubmit(wrapper);
    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/dashboards/new/',
        query: expect.objectContaining({queryFields: ['p95(transaction.duration)']}),
      })
    );
    wrapper.unmount();
  });

  it('can add additional fields', async function () {
    const wrapper = mountModal({initialData});
    // @ts-expect-error
    await tick();
    selectDashboard(wrapper, {label: t('+ Create New Dashboard'), value: 'new'});

    // Click the add button
    const add = wrapper.find('button[aria-label="Add Overlay"]');
    add.simulate('click');
    wrapper.update();

    // Should be another field input.
    expect(wrapper.find('QueryField')).toHaveLength(2);

    selectByLabel(wrapper, 'p95(\u2026)', {name: 'field', at: 1, control: true});

    await clickSubmit(wrapper);

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/dashboards/new/',
        query: expect.objectContaining({
          queryConditions: [''],
          queryFields: ['count()', 'p95(transaction.duration)'],
        }),
      })
    );
    wrapper.unmount();
  });

  it('can add and delete additional queries', async function () {
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/event.type/values/',
      body: [{count: 2, name: 'Nvidia 1080ti'}],
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });

    const wrapper = mountModal({initialData});
    // @ts-expect-error
    await tick();
    selectDashboard(wrapper, {label: t('+ Create New Dashboard'), value: 'new'});

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

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/dashboards/new/',
        query: expect.objectContaining({
          queryConditions: ['event.type:transaction', 'event.type:error'],
          queryFields: ['count()'],
          queryNames: ['Transactions', 'Errors'],
        }),
      })
    );
    wrapper.unmount();
  });

  it('can respond to validation feedback', async function () {
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/widgets/',
      method: 'POST',
      statusCode: 400,
      body: {
        title: ['This field is required'],
        queries: [{conditions: ['Invalid value']}],
      },
    });

    const wrapper = mountModal({initialData});
    // @ts-expect-error
    await tick();
    selectDashboard(wrapper, {label: t('+ Create New Dashboard'), value: 'new'});

    await clickSubmit(wrapper);
    await wrapper.update();

    // API request should fail and not add widget.
    expect(browserHistory.push).not.toHaveBeenCalled();

    const errors = wrapper.find('FieldErrorReason');
    expect(errors).toHaveLength(2);

    // Nested object error should display
    const conditionError = wrapper.find('WidgetQueriesForm FieldErrorReason');
    expect(conditionError).toHaveLength(1);
    wrapper.unmount();
  });

  it('uses count() columns if there are no aggregate fields remaining when switching from table to chart', async function () {
    const wrapper = mountModal({initialData});
    // @ts-expect-error
    await tick();
    selectDashboard(wrapper, {label: t('+ Create New Dashboard'), value: 'new'});
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

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/dashboards/new/',
        query: expect.objectContaining({
          queryConditions: [''],
          queryFields: ['count()'],
        }),
      })
    );
    wrapper.unmount();
  });

  it('should filter out non-aggregate fields when switching from table to chart', async function () {
    const wrapper = mountModal({initialData});
    // @ts-expect-error
    await tick();
    selectDashboard(wrapper, {label: t('+ Create New Dashboard'), value: 'new'});
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

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/dashboards/new/',
        query: expect.objectContaining({
          queryConditions: [''],
          queryFields: ['p95(transaction.duration)'],
        }),
      })
    );
    wrapper.unmount();
  });

  it('should filter non-legal y-axis choices for timeseries widget charts', async function () {
    const wrapper = mountModal({initialData});
    // @ts-expect-error
    await tick();
    selectDashboard(wrapper, {label: t('+ Create New Dashboard'), value: 'new'});
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

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/dashboards/new/',
        query: expect.objectContaining({
          queryConditions: [''],
          queryFields: ['any(measurements.lcp)'],
          displayType: 'line',
        }),
      })
    );
    wrapper.unmount();
  });

  it('should not filter y-axis choices for big number widget charts', async function () {
    const wrapper = mountModal({initialData});
    // @ts-expect-error
    await tick();
    selectDashboard(wrapper, {label: t('+ Create New Dashboard'), value: 'new'});
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

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/dashboards/new/',
        query: expect.objectContaining({
          queryConditions: [''],
          queryFields: ['count_unique(user.display)'],
          displayType: 'big_number',
        }),
      })
    );
    wrapper.unmount();
  });

  it('should filter y-axis choices by output type when switching from big number to line chart', async function () {
    const wrapper = mountModal({initialData});
    // @ts-expect-error
    await tick();
    selectDashboard(wrapper, {label: t('+ Create New Dashboard'), value: 'new'});
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

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/dashboards/new/',
        query: expect.objectContaining({
          queryConditions: [''],
          queryFields: ['count()'],
          displayType: 'line',
        }),
      })
    );
    wrapper.unmount();
  });
});
