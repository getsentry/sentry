import {Fragment} from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import EventView from 'app/utils/discover/eventView';
import HistogramQuery from 'app/utils/performance/histogram/histogramQuery';

function renderHistogram({isLoading, error, histograms}) {
  if (isLoading) {
    return 'loading';
  } else if (error !== null) {
    return 'error';
  } else {
    return (
      <Fragment>
        {Object.keys(histograms).map(name => (
          <Fragment key={name}>
            <p>{name}</p>
            <ul>
              {histograms[name].map(bar => (
                <li key={bar.bin}>{`${bar.bin} - ${bar.count}`}</li>
              ))}
            </ul>
          </Fragment>
        ))}
      </Fragment>
    );
  }
}

describe('HistogramQuery', function () {
  let api, eventView, location;
  beforeEach(function () {
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
      url: '/organizations/test-org/events-histogram/',
      body: {
        'measurements.fp': Array(10)
          .fill(null)
          .map((_, i) => ({bin: i * 1000, count: i})),
      },
    });
    const wrapper = mountWithTheme(
      <HistogramQuery
        api={api}
        location={location}
        eventView={eventView}
        orgSlug="test-org"
        numBuckets={10}
        fields={['fp']}
        min={0}
        max={10000}
      >
        {renderHistogram}
      </HistogramQuery>
    );
    await tick();
    wrapper.update();

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(wrapper.find('p')).toHaveLength(1);
    expect(wrapper.find('li')).toHaveLength(10);
  });
});
