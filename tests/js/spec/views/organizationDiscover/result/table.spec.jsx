import React from 'react';
import {mount} from 'enzyme';

import ResultTable from 'app/views/organizationDiscover/result/table';

describe('ResultTable', function() {
  let wrapper;
  beforeEach(function() {
    wrapper = mount(
      <ResultTable
        query={{aggregations: [], fields: []}}
        data={{
          data: [],
          meta: [],
        }}
      />
    );
  });

  it('getColumnWidths()', function() {
    const mockCanvas = {
      getContext: () => ({
        measureText: () => ({width: 320}),
      }),
    };
    wrapper.instance().canvas = mockCanvas;

    wrapper.setProps({
      data: {data: [{col1: 'foo'}], meta: [{name: 'col1'}]},
      query: {fields: ['col1'], aggregations: []},
    });
    const widths = wrapper.instance().getColumnWidths(500);
    expect(widths).toEqual([341, 40, 117]);
  });

  it('getRowHeight()', function() {
    const mockCanvas = {
      getContext: () => ({
        measureText: text => {
          const lengths = {
            '"long-text"': 3000,
            '"medium-text"': 600,
            '"short-text"': 200,
          };
          return {width: lengths[text] || 300};
        },
      }),
    };

    const columnsToCheck = ['col1'];

    wrapper.instance().canvas = mockCanvas;

    wrapper.setProps({
      data: {
        data: [{col1: 'short-text'}, {col1: 'medium-text'}, {col1: 'long-text'}],
        meta: [{name: 'col1'}],
      },
      query: {fields: ['col1'], aggregations: []},
    });

    expect(wrapper.instance().getRowHeight(0, columnsToCheck)).toBe(31);
    expect(wrapper.instance().getRowHeight(1, columnsToCheck)).toBe(31);
    expect(wrapper.instance().getRowHeight(2, columnsToCheck)).toBe(61);
    expect(wrapper.instance().getRowHeight(3, columnsToCheck)).toBe(91);
  });
});
