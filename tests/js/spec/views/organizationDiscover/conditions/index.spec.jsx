import React from 'react';
import {mount} from 'enzyme';

import Conditions from 'app/views/organizationDiscover/conditions';

describe('Conditions', function() {
  let wrapper, onChangeMock, conditions;
  beforeEach(function() {
    conditions = [['col1', 'IS NOT NULL', null], ['col2', '=', 2]];
    onChangeMock = jest.fn();
    const columns = [{name: 'col1', type: 'string'}, {name: 'col2', type: 'number'}];
    const value = [];
    wrapper = mount(
      <Conditions columns={columns} onChange={onChangeMock} value={value} />
    );
  });
  describe('render()', function() {
    it('renders conditions', function() {
      wrapper.setProps({value: conditions});
      expect(wrapper.find('Condition')).toHaveLength(2);
    });

    it('renders empty text if no conditions', function() {
      expect(wrapper.text()).toContain('None, showing all events');
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
    wrapper.setProps({value: conditions});
    wrapper.instance().removeRow(1);
    expect(onChangeMock).toHaveBeenCalledWith([conditions[0]]);
  });

  it('handleChange', function() {
    wrapper.setProps({value: conditions});
    wrapper.instance().handleChange(['col1', 'IS NULL', null], 0);
    expect(onChangeMock).toHaveBeenCalledWith([['col1', 'IS NULL', null], conditions[1]]);
  });
});
