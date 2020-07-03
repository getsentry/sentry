import React from 'react';

import {mount, render} from 'sentry-test/enzyme';

import {ResultTable} from 'app/views/discover/result/table';

describe('ResultTable', function() {
  let wrapper;
  beforeEach(function() {
    wrapper = mount(
      <ResultTable
        organization={TestStubs.Organization({
          projects: [TestStubs.Project({id: '1'})],
        })}
        query={{aggregations: [], fields: ['id', 'project.id']}}
        data={{
          data: [{id: '111', 'project.id': 1}],
          meta: [
            {name: 'id', type: 'string'},
            {name: 'project.id', type: 'number'},
          ],
        }}
      />
    );
    const mockCanvas = {
      getContext: () => ({
        measureText: () => ({width: 320}),
      }),
    };
    wrapper.instance().canvas = mockCanvas;
  });

  it('getColumnWidths()', function() {
    wrapper.setProps({
      data: {data: [{col1: 'foo'}], meta: [{name: 'col1'}]},
      query: {fields: ['col1'], aggregations: []},
    });
    const widths = wrapper.instance().getColumnWidths(500);
    expect(widths).toEqual([347, 151]);
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

  it('getCellRenderer()', function() {
    const cols = wrapper.instance().getColumnList();
    const cellRenderer = wrapper.instance().getCellRenderer(cols);

    const expectedCellValues = [
      {value: 'id', row: 0, col: 0},
      {value: 'project.id', row: 0, col: 1},
      {value: '111', row: 1, col: 0},
      {value: '1', row: 1, col: 1},
    ];

    expectedCellValues.forEach(function({value, row, col}) {
      const cell = cellRenderer({rowIndex: row, columnIndex: col});
      const markup = render(cell);
      expect(markup.text()).toBe(value);
    });
  });
});
