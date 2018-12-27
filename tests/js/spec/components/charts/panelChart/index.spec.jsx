import React from 'react';
import {mount} from 'enzyme';

import PanelChart from 'app/components/charts/panelChart';

describe('PanelChart', function() {
  const SERIES = [
    {
      seriesName: 'Foo',
      data: [
        {value: 1, name: ''},
        {value: 2, name: ''},
        {value: 3, name: ''},
        {value: 4, name: ''},
      ],
    },
    {
      seriesName: 'Bar',
      data: [
        {value: 2, name: ''},
        {value: 3, name: ''},
        {value: 4, name: ''},
        {value: 5, name: ''},
      ],
    },
  ];

  const PREVIOUS = {
    seriesName: 'Previous',
    data: [
      {value: 2, name: ''},
      {value: 3, name: ''},
      {value: 4, name: ''},
      {value: 5, name: ''},
    ],
  };

  describe('renders', function() {
    let wrapper;
    beforeAll(function() {
      wrapper = mount(
        <PanelChart title="Panel Chart" series={SERIES} previousPeriod={PREVIOUS}>
          <div />
        </PanelChart>,
        TestStubs.routerContext()
      );
    });

    it('has title', function() {
      expect(wrapper.find('PanelHeader').contains('Panel Chart')).toBe(true);
    });

    it('has right legend items', function() {
      // Currently only support 1 line
      expect(wrapper.find('DottedLineIndicator')).toHaveLength(1);
      expect(
        wrapper
          .find('SeriesName')
          .at(0)
          .prop('children')
      ).toBe('Previous');

      expect(wrapper.find('CircleIndicator')).toHaveLength(2);
      expect(
        wrapper
          .find('SeriesName')
          .at(1)
          .prop('children')
      ).toBe('Foo');
      expect(
        wrapper
          .find('SeriesName')
          .at(2)
          .prop('children')
      ).toBe('Bar');
    });

    it('renders child', function() {
      expect(wrapper.find('ChartWrapper')).toHaveLength(1);
    });
  });

  it('shows legend without a title', function() {
    let wrapper = mount(
      <PanelChart series={SERIES} previousPeriod={PREVIOUS}>
        <div />
      </PanelChart>,
      TestStubs.routerContext()
    );

    // This has 2 results because of the Legend class and styled-component wrapper
    expect(wrapper.find('Legend')).toHaveLength(2);
  });
});
