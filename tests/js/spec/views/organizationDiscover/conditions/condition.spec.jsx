import React from 'react';
import {mount} from 'enzyme';

import Condition from 'app/views/organizationDiscover/conditions/condition';

describe('Condition', function() {
  describe('render()', function() {
    it('renders text', function() {
      const data = [
        {value: [null, null, null], expectedText: 'Add condition...'},
        {value: ['device.name', '=', 'test'], expectedText: 'device.name = test'},
        {value: ['device.name', 'IS NULL', null], expectedText: 'device.name IS NULL'},
        {
          value: ['device.battery_level', '>', 5],
          expectedText: 'device.battery_level > 5',
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
        {name: 'col3', type: 'datetime'},
        {name: 'error.type', type: 'string'},
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
      wrapper.setState({inputValue: 'col1'});
      const options = wrapper.instance().filterOptions([]);
      expect(options).toHaveLength(6);
      expect(options[0]).toEqual({value: 'col1 =', label: 'col1 ='});
    });

    it('renders operator options for number column', function() {
      wrapper.setState({inputValue: 'col2'});
      const options = wrapper.instance().filterOptions([]);
      expect(options).toHaveLength(8);
      expect(options[0]).toEqual({value: 'col2 >', label: 'col2 >'});
    });

    it('renders operator options for datetime column', function() {
      wrapper.setState({inputValue: 'col3'});
      const options = wrapper.instance().filterOptions([]);
      expect(options).toHaveLength(8);
      expect(options[0]).toEqual({value: 'col3 >', label: 'col3 >'});
      expect(options[1]).toEqual({value: 'col3 <', label: 'col3 <'});
      expect(options[2]).toEqual({value: 'col3 >=', label: 'col3 >='});
      expect(options[3]).toEqual({value: 'col3 <=', label: 'col3 <='});
      expect(options[4]).toEqual({value: 'col3 =', label: 'col3 ='});
      expect(options[5]).toEqual({value: 'col3 !=', label: 'col3 !='});
      expect(options[6]).toEqual({value: 'col3 IS NULL', label: 'col3 IS NULL'});
      expect(options[7]).toEqual({value: 'col3 IS NOT NULL', label: 'col3 IS NOT NULL'});
    });

    it('limits operators to = and != for array fields', function() {
      wrapper.setState({inputValue: 'error.type'});
      const options = wrapper.instance().filterOptions([]);
      expect(options).toHaveLength(2);
      expect(options[0].value).toEqual('error.type =');
      expect(options[1].value).toEqual('error.type !=');
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
