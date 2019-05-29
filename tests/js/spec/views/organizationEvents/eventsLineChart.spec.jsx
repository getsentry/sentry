import React from 'react';

import {Client} from 'app/api';
import {EventsChart} from 'app/views/organizationEvents/eventsChart';
import {mockZoomRange} from 'app-test/helpers/charts';
import {initializeOrg} from 'app-test/helpers/initializeOrg';
import {mount} from 'enzyme';

describe('EventsChart > EventsLineChart', function() {
  const {router, routerContext, org} = initializeOrg();
  let wrapper;

  beforeEach(function() {
    mockZoomRange(1543449600000, 1543708800000);
    Client.addMockResponse({
      url: `/organizations/${org.slug}/events-stats/`,
      method: 'GET',
      body: {
        data: [[1543449600, [20, 12]], [1543449601, [10, 5]]],
      },
    });

    wrapper = mount(
      <EventsChart
        api={new MockApiClient()}
        location={{query: {}}}
        organization={org}
        project={[]}
        environment={[]}
        period="14d"
        start={null}
        end={null}
        utc={false}
        router={router}
        showLegend={true}
      />,
      routerContext
    );
  });

  it('renders a legend if enabled', function() {
    wrapper.update();

    const lineChart = wrapper.find('LineChart');
    expect(lineChart.props().legend).toHaveProperty('data');
  });

  it('responds to y-axis changes', function() {
    const options = [
      {label: 'users', value: 'user_count'},
      {label: 'events', value: 'event_count'},
    ];
    wrapper.setProps({yAxisOptions: options});
    wrapper.update();
    const selector = wrapper.find('YAxisSelector');
    expect(selector).toHaveLength(1);

    // Open the selector
    selector.find('StyledDropdownButton button').simulate('click');

    // Click one of the options.
    selector
      .find('DropdownMenu MenuItem a')
      .first()
      .simulate('click');
    wrapper.update();

    const eventsRequest = wrapper.find('EventsRequest');
    expect(eventsRequest.props().yAxis).toEqual('user_count');
  });
});
