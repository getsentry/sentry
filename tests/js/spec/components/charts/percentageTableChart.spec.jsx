import React from 'react';

import {mount} from 'sentry-test/enzyme';

import PercentageTableChart from 'app/components/charts/percentageTableChart';

describe('PercentageTableChart', function() {
  let wrapper;

  describe('With Previous Data', function() {
    beforeEach(function() {
      wrapper = mount(
        <PercentageTableChart
          title="User"
          data={[
            {
              value: 40,
              lastValue: 20,
              name: 'billy',
              percentage: 40,
            },
            {
              value: 60,
              lastValue: 120,
              name: 'not billy',
              percentage: 60,
            },
          ]}
        />
      );
    });

    it('renders headers', function() {
      expect(
        wrapper.find('TableHeader NameAndCountContainer').prop('children')
      ).toHaveLength(2);

      expect(wrapper.find('TableHeader').text()).toContain('User');
      expect(wrapper.find('TableHeader').text()).toContain('Count');
      expect(wrapper.find('TableHeader').text()).toContain('Percentage');
    });

    it('renders data rows', function() {
      expect(wrapper.find('TableChartRow')).toHaveLength(2);

      expect(
        wrapper
          .find('TableChartRow Name')
          .at(0)
          .text()
      ).toBe('billy');

      expect(
        wrapper
          .find('TableChartRow CountColumn IconChevron')
          .at(0)
          .prop('direction')
      ).toEqual('up');

      expect(
        wrapper
          .find('TableChartRow Bar')
          .at(0)
          .prop('width')
      ).toBe(40);

      expect(
        wrapper
          .find('TableChartRow Name')
          .at(1)
          .text()
      ).toBe('not billy');

      expect(
        wrapper
          .find('TableChartRow CountColumn IconChevron')
          .at(1)
          .prop('direction')
      ).toEqual('down');

      expect(
        wrapper
          .find('TableChartRow Bar')
          .at(1)
          .prop('width')
      ).toBe(60);
    });
  });

  describe('Without Previous Data', function() {
    beforeEach(function() {
      wrapper = mount(
        <PercentageTableChart
          title="User"
          data={[
            {
              value: 40,
              name: 'billy',
              percentage: 40,
            },
            {
              value: 60,
              name: 'not billy',
              percentage: 60,
            },
          ]}
        />
      );
    });

    it('renders data rows', function() {
      expect(wrapper.find('TableChartRow')).toHaveLength(2);

      expect(
        wrapper
          .find('TableChartRow Name')
          .at(0)
          .text()
      ).toBe('billy');

      expect(wrapper.find('TableChartRow CountColumn DeltaCaret')).toHaveLength(0);

      expect(
        wrapper
          .find('TableChartRow Bar')
          .at(0)
          .prop('width')
      ).toBe(40);

      expect(
        wrapper
          .find('TableChartRow Name')
          .at(1)
          .text()
      ).toBe('not billy');

      expect(
        wrapper
          .find('TableChartRow Bar')
          .at(1)
          .prop('width')
      ).toBe(60);
    });
  });
});
