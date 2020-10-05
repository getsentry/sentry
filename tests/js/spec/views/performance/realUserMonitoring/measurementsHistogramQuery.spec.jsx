import React from 'react';

import {mount} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import EventView from 'app/utils/discover/eventView';
import MeasurementsHistogramQuery from 'app/views/performance/realUserMonitoring/measurementsHistogramQuery';

function renderHistogram({isLoading, error, histograms}) {
  if (isLoading) {
    return 'loading';
  } else if (error !== null) {
    return 'error';
  } else {
    return (
      <React.Fragment>
        {Object.keys(histograms).map(name => (
          <React.Fragment key={name}>
            <p>{name}</p>
            <ul>
              {histograms[name].map(bin => (
                <li key={bin.histogram}>{`${bin.histogram} - ${bin.count}`}</li>
              ))}
            </ul>
          </React.Fragment>
        ))}
      </React.Fragment>
    );
  }
}

describe('MeasurementsHistogramQuery', function () {
  let api, eventView, location;
  beforeEach(() => {
    api = new Client();
    location = {
      pathname: '/',
      query: {},
    };
    eventView = EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: ['id'],
      projects: [],
      environment: ['dev'],
    });
  });

  it('fetches data on mount', async function () {
    const getMock = MockApiClient.addMockResponse({
      url: '/organizations/test-org/events-measurements-histogram/',
      body: {
        meta: {key: 'string', bin: 'number', count: 'number'},
        data: Array(10)
          .fill(null)
          .map((_, i) => ({key: 'fp', bin: i * 1000, count: i})),
      },
    });
    const wrapper = mount(
      <MeasurementsHistogramQuery
        api={api}
        location={location}
        eventView={eventView}
        orgSlug="test-org"
        numBuckets={10}
        measurements={['fp']}
        min={0}
        max={10000}
      >
        {renderHistogram}
      </MeasurementsHistogramQuery>
    );
    await tick();
    wrapper.update();

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(wrapper.find('p')).toHaveLength(1);
    expect(wrapper.find('li')).toHaveLength(10);
  });
});
