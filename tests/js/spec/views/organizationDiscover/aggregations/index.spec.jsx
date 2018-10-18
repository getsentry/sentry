import React from 'react';
import {mount} from 'enzyme';

import Aggregations from 'app/views/organizationDiscover/aggregations';

describe('Aggregations', function() {
  let wrapper, onChangeMock, aggregations;
  beforeEach(function() {
    aggregations = [['count()', null, 'count'], ['uniq', 'col1', 'uniq_col1']];
    onChangeMock = jest.fn();
    const columns = [{name: 'col1', type: 'string'}, {name: 'col2', type: 'number'}];
    const value = [];
    wrapper = mount(
      <Aggregations columns={columns} onChange={onChangeMock} value={value} />
    );
  });
  describe('render()', function() {
    it('renders aggregations', function() {
      wrapper.setProps({value: aggregations});
      expect(wrapper.find('Aggregation')).toHaveLength(2);
    });

    it('renders empty text if no conditions', function() {
      expect(wrapper.text()).toContain('None, showing raw event data');
    });
  });

  it('addRow()', function() {
    wrapper
      .find('AddText')
      .find('Link')
      .simulate('click');
    expect(onChangeMock).toHaveBeenCalledWith([[null, null, null]]);
  });

  it('removeRow()', function() {
    wrapper.setProps({value: aggregations});
    wrapper.instance().removeRow(1);
    expect(onChangeMock).toHaveBeenCalledWith([aggregations[0]]);
  });

  it('handleChange', function() {
    wrapper.setProps({value: aggregations});
    wrapper.instance().handleChange(['uniq', 'col2', null], 1);
    expect(onChangeMock).toHaveBeenCalledWith([aggregations[0], ['uniq', 'col2', null]]);
  });
});
