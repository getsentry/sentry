import React from 'react';
import {mount} from 'enzyme';

import Condition from 'app/views/organizationDiscover/conditions/condition';

describe('Condition', function() {
  describe('render()', function() {
    it('renders text', function() {
      const data = [
        {value: [null, null, null], expectedText: 'Add condition...'},
        {value: ['device_name', '=', 'test'], expectedText: 'device_name = test'},
        {value: ['device_name', 'IS NULL', null], expectedText: 'device_name IS NULL'},
        {
          value: ['device_battery_level', '>', 5],
          expectedText: 'device_battery_level > 5',
        },
      ];
      data.forEach(function(condition) {
        const wrapper = mount(
          <Condition value={condition.value} onChange={jest.fn()} columns={[]} />
        );
        expect(wrapper.text()).toBe(condition.expectedText);
      });
    });
  });

  describe('filterOptions()', function() {
    let wrapper;
    beforeEach(function() {
      const columns = [
        {name: 'col1', type: 'string'},
        {name: 'col2', type: 'number'},
        {name: 'exception_stacks.type', type: 'string'},
      ];
      wrapper = mount(
        <Condition value={[null, null, null]} onChange={jest.fn()} columns={columns} />
      );
    });

    it('renders column name options if no input', function() {
      const options = wrapper.instance().filterOptions([], '');
      expect(options[0]).toEqual({value: 'col1', label: 'col1...'});
      expect(options[1]).toEqual({value: 'col2', label: 'col2...'});
    });

    it('renders operator options for string column', function() {
      const options = wrapper.instance().filterOptions([], 'col1');
      expect(options).toHaveLength(6);
      expect(options[0]).toEqual({value: 'col1 =', label: 'col1 ='});
    });

    it('renders operator options for number column', function() {
      const options = wrapper.instance().filterOptions([], 'col2');
      expect(options).toHaveLength(8);
      expect(options[0]).toEqual({value: 'col2 >', label: 'col2 >'});
    });

    it('limits operators to = and != for array fields', function() {
      const options = wrapper.instance().filterOptions([], 'exception_stacks.type');
      expect(options).toHaveLength(2);
      expect(options[0].value).toEqual('exception_stacks.type =');
      expect(options[1].value).toEqual('exception_stacks.type !=');
    });
  });

  describe('handleChange()', function() {
    let wrapper, focusSpy;
    let onChangeMock = jest.fn();
    beforeEach(function() {
      focusSpy = jest.spyOn(Condition.prototype, 'focus');
      const columns = [{name: 'col1', type: 'string'}, {name: 'col2', type: 'number'}];
      wrapper = mount(
        <Condition value={[null, null, null]} onChange={onChangeMock} columns={columns} />
      );
    });

    afterEach(function() {
      jest.clearAllMocks();
    });

    it('handles valid final conditions', function() {
      const conditionList = [
        'col1 = test',
        'col2 > 3',
        'col1 LIKE %something%',
        'col2 IS NULL',
      ];
      conditionList.forEach(function(value) {
        wrapper.instance().handleChange({value});
        expect(onChangeMock).toHaveBeenCalled();
        expect(focusSpy).not.toHaveBeenCalled();
      });
    });

    it('handles intermediate condition states', function() {
      const conditionList = ['col1', 'col2', 'col2 <'];
      conditionList.forEach(function(value) {
        wrapper.instance().handleChange({value});
        expect(onChangeMock).not.toHaveBeenCalled();
        expect(focusSpy).toHaveBeenCalled();
      });
    });
  });
});
