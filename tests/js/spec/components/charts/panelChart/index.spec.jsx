import React from 'react';
import {mount} from 'enzyme';

import PanelChart from 'app/components/charts/panelChart';

describe('PanelChart', function() {
  describe('renders', function() {
    let wrapper;
    beforeAll(function() {
      wrapper = mount(
        <PanelChart
          title="Panel Chart"
          series={[
            {
              seriesName: 'Foo',
              data: [1, 2, 3, 4],
            },
            {
              seriesName: 'Bar',
              data: [2, 3, 4, 5],
            },
          ]}
          previousPeriod={{
            seriesName: 'Previous',
            data: [1, 2, 3, 4],
          }}
        >
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
      <PanelChart
        series={[
          {
            seriesName: 'Foo',
            data: [1, 2, 3, 4],
          },
          {
            seriesName: 'Bar',
            data: [2, 3, 4, 5],
          },
        ]}
        previousPeriod={{
          seriesName: 'Previous',
          data: [1, 2, 3, 4],
        }}
      >
        <div />
      </PanelChart>,
      TestStubs.routerContext()
    );

    // This has 2 results because of the Legend class and styled-component wrapper
    expect(wrapper.find('Legend')).toHaveLength(2);
  });
});
