import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {selectByLabel} from 'sentry-test/select-new';

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

describe('Modals -> AddDashboardWidgetModal', function () {
  const initialData = initializeOrg({
    organization: {
      features: ['performance-view'],
      apdexThreshold: 400,
    },
  });
  const tags = [
    {name: 'browser.name', key: 'browser.name'},
    {name: 'custom-field', key: 'custom-field'},
  ];

  beforeEach(function () {
    TagStore.onLoadTagsSuccess(tags);
  });

  it('can update the title', function () {
    let widget = undefined;
    const wrapper = mountModal({
      initialData,
      onAddWidget: data => (widget = data),
    });
    const input = wrapper.find('Input[name="title"] input');
    input.simulate('change', {target: {value: 'Unique Users'}});

    // Click on submit.
    const button = wrapper.find('Button[data-test-id="add-widget"] button');
    button.simulate('click');

    expect(widget.title).toEqual('Unique Users');
  });

  it('can add conditions', function () {
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

    // Click on submit.
    const button = wrapper.find('Button[data-test-id="add-widget"] button');
    button.simulate('click');

    expect(widget.queries).toHaveLength(1);
    expect(widget.queries[0].conditions).toEqual('color:blue');
  });

  it('can choose a field', function () {
    let widget = undefined;
    const wrapper = mountModal({
      initialData,
      onAddWidget: data => (widget = data),
    });
    // No delete button as there is only one field.
    expect(wrapper.find('IconDelete')).toHaveLength(0);

    selectByLabel(wrapper, 'p95(\u2026)', {name: 'field', at: 0, control: true});

    // Click on submit.
    const button = wrapper.find('Button[data-test-id="add-widget"] button');
    button.simulate('click');

    expect(widget.queries).toHaveLength(1);
    expect(widget.queries[0].fields).toEqual(['p95(transaction.duration)']);
  });

  it('can add additional fields', function () {
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

    // Click on submit.
    const button = wrapper.find('Button[data-test-id="add-widget"] button');
    button.simulate('click');

    expect(widget.queries).toHaveLength(1);
    expect(widget.queries[0].fields).toEqual(['count()', 'p95(transaction.duration)']);
  });
});
