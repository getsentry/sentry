import React from 'react';
import {mount} from 'enzyme';

import Aggregation from 'app/views/organizationDiscover/aggregations/aggregation';

describe('Aggregation', function() {
  describe('render()', function() {
    it('renders empty, count, topK, uniq and avg', async function() {
      const data = [
        {value: [null, null, null], expectedTextValue: 'Add aggregation function...'},
        {value: ['count()', null, 'count'], expectedTextValue: 'count'},
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
        {
          value: ['uniq', 'tags[message]', 'uniq_tags_message'],
          expectedTextValue: 'uniq(tags[message])',
        },
      ];

      data.forEach(async function(item) {
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
      wrapper.setState({inputValue: ''});
      const options = wrapper.instance().filterOptions();

      expect(options).toHaveLength(4);
      expect(options.map(({value}) => value)).toEqual(['count', 'uniq', 'topK', 'avg']);
    });

    it('displays uniq options on input `uniq`', function() {
      wrapper.setState({inputValue: 'uniq'});
      const options = wrapper.instance().filterOptions();
      expect(options).toHaveLength(2);
      expect(options[0]).toEqual({value: 'uniq(col1)', label: 'uniq(col1)'});
      expect(options[1]).toEqual({value: 'uniq(col2)', label: 'uniq(col2)'});
    });

    it('displays number value options on input `avg`', function() {
      wrapper.setState({inputValue: 'avg'});
      const options = wrapper.instance().filterOptions();
      expect(options).toHaveLength(1);
      expect(options[0]).toEqual({value: 'avg(col2)', label: 'avg(col2)'});
    });

    it('displays TopK value options on input `topK`', function() {
      wrapper.setState({inputValue: 'topK'});
      const options = wrapper.instance().filterOptions();
      expect(options).toHaveLength(5);
      expect(options[0]).toEqual({value: 'topK(5)', label: 'topK(5)(...)'});
    });

    it('displays TopK column options on input topK(5)', function() {
      wrapper.setState({inputValue: 'topK(5)'});
      const options = wrapper.instance().filterOptions();
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
        expect(wrapper.instance().state.inputValue).toBe('uniq');
        expect(focusSpy).toHaveBeenCalled();
      });

      it('avg', function() {
        wrapper.instance().handleChange({value: 'avg'});
        expect(wrapper.instance().state.inputValue).toBe('avg');
        expect(focusSpy).toHaveBeenCalled();
      });

      it('topK without number', function() {
        wrapper.instance().handleChange({value: 'topK'});
        expect(wrapper.instance().state.inputValue).toBe('topK');
        expect(focusSpy).toHaveBeenCalled();
      });

      it('topK with number', function() {
        wrapper.instance().handleChange({value: 'topK(10)'});
        expect(wrapper.instance().state.inputValue).toBe('topK(10)');
        expect(focusSpy).toHaveBeenCalled();
      });
    });

    describe('handles final selections', function() {
      const validFinalSelections = ['count', 'avg(col2)', 'uniq(col1)', 'topK(10)(col2)'];

      it('handles count, avg, uniq, topK', function() {
        validFinalSelections.forEach(function(value) {
          wrapper.instance().handleChange({value});
          expect(wrapper.instance().state.inputValue).toBe(value);
          expect(focusSpy).not.toHaveBeenCalled();
        });
      });
    });
  });
});
