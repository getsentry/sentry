import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import Aggregation from 'app/views/discover/aggregations/aggregation';

describe('Aggregation', function () {
  describe('render()', function () {
    it('renders empty, count, uniq, avg and sum', async function () {
      const data = [
        {value: [null, null, null], expectedTextValue: 'Add aggregation function...'},
        {value: ['count()', null, 'count'], expectedTextValue: 'count'},
        {
          value: ['uniq', 'environment', 'uniq_environment'],
          expectedTextValue: 'uniq(environment)',
        },
        {
          value: ['avg', 'device.battery_level', 'avg_device_battery_level'],
          expectedTextValue: 'avg(device.battery_level)',
        },
        {
          value: ['sum', 'device.battery_level', 'sum_device_battery_level'],
          expectedTextValue: 'sum(device.battery_level)',
        },
        {
          value: ['uniq', 'message', 'uniq_message'],
          expectedTextValue: 'uniq(message)',
        },
      ];

      data.forEach(async function (item) {
        const wrapper = mountWithTheme(
          <Aggregation value={item.value} onChange={jest.fn()} columns={[]} />,
          TestStubs.routerContext()
        );
        expect(wrapper.text()).toBe(item.expectedTextValue);
      });
    });
  });

  describe('filterOptions()', function () {
    let wrapper;
    beforeEach(function () {
      const cols = [
        {name: 'col1', type: 'string'},
        {name: 'col2', type: 'number'},
        {name: 'error.type', type: 'string'},
      ];
      wrapper = mountWithTheme(
        <Aggregation value={[null, null, null]} onChange={jest.fn()} columns={cols} />,
        TestStubs.routerContext()
      );
    });

    it('displays top level options with no input', function () {
      wrapper.setState({inputValue: ''});
      const options = wrapper.instance().filterOptions();

      expect(options).toHaveLength(4);
      expect(options.map(({value}) => value)).toEqual(['count', 'uniq', 'avg', 'sum']);
    });

    it('displays uniq options for non-array fields only', function () {
      wrapper.setState({inputValue: 'uniq'});
      const options = wrapper.instance().filterOptions();
      expect(options).toHaveLength(2);
      expect(options[0]).toEqual({value: 'uniq(col1)', label: 'uniq(col1)'});
      expect(options[1]).toEqual({value: 'uniq(col2)', label: 'uniq(col2)'});
    });

    it('displays number value options on input `avg`', function () {
      wrapper.setState({inputValue: 'avg'});
      const options = wrapper.instance().filterOptions();
      expect(options).toHaveLength(1);
      expect(options[0]).toEqual({value: 'avg(col2)', label: 'avg(col2)'});
    });

    it('displays number value options on input `sum`', function () {
      wrapper.setState({inputValue: 'sum'});
      const options = wrapper.instance().filterOptions();
      expect(options).toHaveLength(1);
      expect(options[0]).toEqual({value: 'sum(col2)', label: 'sum(col2)'});
    });
  });

  describe('handleChange()', function () {
    let wrapper, focusSpy;
    beforeEach(function () {
      const cols = [
        {name: 'col1', type: 'string'},
        {name: 'col2', type: 'number'},
      ];
      focusSpy = jest.spyOn(Aggregation.prototype, 'focus');

      wrapper = mountWithTheme(
        <Aggregation value={[null, null, null]} onChange={jest.fn()} columns={cols} />,
        TestStubs.routerContext()
      );
    });

    afterEach(function () {
      jest.clearAllMocks();
    });

    describe('handles intermediate selections', function () {
      it('uniq', function () {
        wrapper.instance().handleChange({value: 'uniq'});
        expect(wrapper.instance().state.inputValue).toBe('uniq');
        expect(focusSpy).toHaveBeenCalled();
      });

      it('avg', function () {
        wrapper.instance().handleChange({value: 'avg'});
        expect(wrapper.instance().state.inputValue).toBe('avg');
        expect(focusSpy).toHaveBeenCalled();
      });

      it('sum', function () {
        wrapper.instance().handleChange({value: 'sum'});
        expect(wrapper.instance().state.inputValue).toBe('sum');
        expect(focusSpy).toHaveBeenCalled();
      });
    });

    describe('handles final selections', function () {
      const validFinalSelections = ['count', 'avg(col2)', 'uniq(col1)', 'sum(col2)'];

      it('handles count, avg, uniq, sum', function () {
        validFinalSelections.forEach(function (value) {
          wrapper.instance().handleChange({value});
          expect(wrapper.instance().state.inputValue).toBe(value);
          expect(focusSpy).not.toHaveBeenCalled();
        });
      });
    });
  });
});
