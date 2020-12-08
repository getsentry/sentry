import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {findOption, openMenu, selectByLabel} from 'sentry-test/select-new';

import AddDashboardWidgetModal from 'app/components/modals/addDashboardWidgetModal';
import TagStore from 'app/stores/tagStore';

const stubEl = props => <div>{props.children}</div>;

function mountModal({onAddWidget, initialData}) {
  return mountWithTheme(
    <AddDashboardWidgetModal
      Header={stubEl}
      Footer={stubEl}
      Body={stubEl}
      organization={initialData.organization}
      onAddWidget={onAddWidget}
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
  return tick();
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
  const discoverQuery = TestStubs.DiscoverSavedQuery({
    name: 'Users with errors',
    query: 'event.type: error',
    fields: ['title', 'count_unique(user)'],
    yAxis: 'count_unique(user)',
  });

  beforeEach(function () {
    TagStore.onLoadTagsSuccess(tags);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/saved/',
      body: [discoverQuery],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/widgets/',
      method: 'POST',
      statusCode: 200,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
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
  });

  it('can add additional fields', async function () {
    let widget = undefined;
    const wrapper = mountModal({
      initialData,
      onAddWidget: data => (widget = data),
    });

    // Click the add button
    const add = wrapper.find('Button[data-test-id="add-field"] button');
    add.simulate('click');
    wrapper.update();

    // Should be another field input.
    expect(wrapper.find('QueryField')).toHaveLength(2);

    selectByLabel(wrapper, 'p95(\u2026)', {name: 'field', at: 1, control: true});

    await clickSubmit(wrapper);

    expect(widget.queries).toHaveLength(1);
    expect(widget.queries[0].fields).toEqual(['count()', 'p95(transaction.duration)']);
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
    const conditionError = wrapper.find('WidgetQueryForm FieldErrorReason');
    expect(conditionError).toHaveLength(1);
  });

  it('can set query state using discover queries', async function () {
    let widget = undefined;
    const wrapper = mountModal({
      initialData,
      onAddWidget: data => {
        widget = data;
      },
    });

    openMenu(wrapper, {name: 'discoverQuery', control: true});

    // Multiple updates for react-select.
    await wrapper.update();
    await wrapper.update();
    await wrapper.update();

    findOption(
      wrapper,
      {label: 'Users with errors'},
      {name: 'discoverQuery', control: true}
    )
      .at(0)
      .simulate('click');

    await clickSubmit(wrapper);

    expect(widget.queries[0].conditions).toEqual(discoverQuery.query);
    expect(widget.queries[0].fields).toEqual([discoverQuery.yAxis]);
  });
});
