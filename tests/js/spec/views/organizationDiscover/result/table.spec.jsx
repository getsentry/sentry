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
    expect(widths).toEqual([340, 40, 120]);
  });
});
