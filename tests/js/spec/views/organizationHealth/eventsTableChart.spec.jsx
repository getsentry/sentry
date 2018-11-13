import React from 'react';
import {mount} from 'enzyme';
import EventsTableChart from 'app/views/organizationHealth/eventsTableChart';

describe('EventsTableChart', function() {
  let wrapper;

  beforeEach(function() {
    wrapper = mount(
      <EventsTableChart
        headers={['User', <span key="events-column">Events</span>, null, 'Last Column']}
        data={[
          {
            count: 40,
            lastCount: 20,
            name: 'billy',
            percentage: 40,
          },
          {
            count: 60,
            lastCount: 120,
            name: 'not billy',
            percentage: 60,
          },
        ]}
      />
    );
  });

  it('renders headers', function() {
    expect(
      wrapper.find('PanelHeader NameAndEventsContainer').prop('children')
    ).toHaveLength(2);

    expect(wrapper.find('PanelHeader').text()).toContain('User');
    expect(wrapper.find('PanelHeader').text()).toContain('Events');
    expect(wrapper.find('PanelHeader').text()).toContain('Last Column');
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
        .find('TableChartRow Events DeltaCaret')
        .at(0)
        .prop('direction')
    ).toBeGreaterThan(0);

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
        .find('TableChartRow Events DeltaCaret')
        .at(1)
        .prop('direction')
    ).toBeLessThan(0);

    expect(
      wrapper
        .find('TableChartRow Bar')
        .at(1)
        .prop('width')
    ).toBe(60);
  });
});
