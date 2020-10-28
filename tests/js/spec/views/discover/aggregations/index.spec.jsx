import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import Aggregations from 'app/views/discover/aggregations';

describe('Aggregations', function () {
  let wrapper, onChangeMock, aggregations;
  beforeEach(function () {
    aggregations = [
      ['count()', null, 'count'],
      ['uniq', 'col1', 'uniq_col1'],
    ];
    onChangeMock = jest.fn();
    const columns = [
      {name: 'col1', type: 'string'},
      {name: 'col2', type: 'number'},
    ];
    const value = [];
    wrapper = mountWithTheme(
      <Aggregations columns={columns} onChange={onChangeMock} value={value} />,
      TestStubs.routerContext()
    );
  });
  describe('render()', function () {
    it('renders aggregations', function () {
      wrapper.setProps({value: aggregations});
      expect(wrapper.find('AggregationRow')).toHaveLength(2);
    });

    it('renders empty text if no conditions', function () {
      expect(wrapper.text()).toContain('None, showing raw event data');
    });
  });

  it('addRow()', function () {
    wrapper
      .find('AddText')
      .find("[data-test-id='aggregation-add-text-link']")
      .hostNodes()
      .simulate('click');
    expect(onChangeMock).toHaveBeenCalledWith([[null, null, null]]);
  });

  it('removeRow()', function () {
    wrapper.setProps({value: aggregations});
    wrapper.instance().removeRow(1);
    expect(onChangeMock).toHaveBeenCalledWith([aggregations[0]]);
  });

  it('handleChange', function () {
    wrapper.setProps({value: aggregations});
    wrapper.instance().handleChange(['uniq', 'col2', null], 1);
    expect(onChangeMock).toHaveBeenCalledWith([aggregations[0], ['uniq', 'col2', null]]);
  });
});
