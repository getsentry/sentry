import React from 'react';
import {mount} from 'enzyme';

import Aggregation from 'app/views/organizationDiscover/aggregations/aggregation';

describe('Aggregation', function() {
  describe('render()', function() {
    it('renders empty, count, topK, uniq and avg', function() {
      const data = [
        {value: [null, null, null], expectedTextValue: 'Select...'},
        {value: ['count', null, 'count'], expectedTextValue: 'count'},
        {
          value: ['uniq', 'environment', 'uniq_environment'],
          expectedTextValue: 'uniq(environment)',
        },
        {
          value: ['avg', 'retention_days', 'avg_retention_days'],
          expectedTextValue: 'avg(retention_days)',
        },
        {
          value: ['topK(5)', 'environment', 'topK_5_environment'],
          expectedTextValue: 'topK(5)(environment)',
        },
      ];

      data.forEach(function(item) {
        const wrapper = mount(
          <Aggregation value={item.value} onChange={jest.fn()} columns={[]} />
        );
        expect(wrapper.text()).toBe(item.expectedTextValue);
      });
    });
  });

  describe('filterOptions()', function() {
    let wrapper;
    beforeEach(function() {
      const cols = [{name: 'col1', type: 'string'}, {name: 'col2', type: 'number'}];
      wrapper = mount(
        <Aggregation value={[null, null, null]} onChange={jest.fn()} columns={cols} />
      );
    });

    it('displays top level options with no input', function() {
      const options = wrapper.instance().filterOptions(null, '', null);

      expect(options).toHaveLength(4);
      expect(options.map(({value}) => value)).toEqual(['count', 'uniq', 'topK', 'avg']);
    });

    it('displays uniq options on input `uniq`', function() {
      const options = wrapper.instance().filterOptions(null, 'uniq', null);
      expect(options).toHaveLength(2);
      expect(options[0]).toEqual({value: 'uniq(col1)', label: 'uniq(col1)'});
      expect(options[1]).toEqual({value: 'uniq(col2)', label: 'uniq(col2)'});
    });

    it('displays number value options on input `avg`', function() {
      const options = wrapper.instance().filterOptions(null, 'avg', null);
      expect(options).toHaveLength(1);
      expect(options[0]).toEqual({value: 'avg(col2)', label: 'avg(col2)'});
    });

    it('displays TopK value options on input `topK`', function() {
      const options = wrapper.instance().filterOptions(null, 'topK', null);
      expect(options).toHaveLength(5);
      expect(options[0]).toEqual({value: 'topK(5)', label: 'topK(5)(...)'});
    });

    it('displays TopK column options on input topK(5)', function() {
      const options = wrapper.instance().filterOptions(null, 'topK(5)', null);
      expect(options).toHaveLength(2);
      expect(options[0]).toEqual({value: 'topK(5)(col1)', label: 'topK(5)(col1)'});
      expect(options[1]).toEqual({value: 'topK(5)(col2)', label: 'topK(5)(col2)'});
    });
  });

  describe('handleChange()', function() {
    let wrapper, focusSpy;
    beforeEach(function() {
      const cols = [{name: 'col1', type: 'string'}, {name: 'col2', type: 'number'}];
      focusSpy = jest.spyOn(Aggregation.prototype, 'focus');

      wrapper = mount(
        <Aggregation value={[null, null, null]} onChange={jest.fn()} columns={cols} />
      );
    });

    afterEach(function() {
      jest.clearAllMocks();
    });

    describe('handles intermediate selections', function() {
      it('uniq', function() {
        wrapper.instance().handleChange({value: 'uniq'});
        expect(wrapper.instance().state.selectedFunction).toBe('uniq');
        expect(focusSpy).toHaveBeenCalled();
      });

      it('avg', function() {
        wrapper.instance().handleChange({value: 'avg'});
        expect(wrapper.instance().state.selectedFunction).toBe('avg');
        expect(focusSpy).toHaveBeenCalled();
      });

      it('topK without number', function() {
        wrapper.instance().handleChange({value: 'topK'});
        expect(wrapper.instance().state.selectedFunction).toBe('topK');
        expect(focusSpy).toHaveBeenCalled();
      });

      it('topK with number', function() {
        wrapper.instance().handleChange({value: 'topK(10)'});
        expect(wrapper.instance().state.selectedFunction).toBe('topK(10)');
        expect(focusSpy).toHaveBeenCalled();
      });
    });

    describe('handles final selections', function() {
      const validFinalSelections = ['count', 'avg(col2)', 'uniq(col1)', 'topK(10)(col2)'];

      it('handles count, avg, uniq, topK', function() {
        validFinalSelections.forEach(function(value) {
          wrapper.instance().handleChange({value});
          expect(wrapper.instance().state.selectedFunction).toBe(null);
          expect(focusSpy).not.toHaveBeenCalled();
        });
      });
    });
  });
});
