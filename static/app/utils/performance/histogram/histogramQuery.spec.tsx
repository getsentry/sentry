import {Fragment} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventView from 'sentry/utils/discover/eventView';
import HistogramQuery from 'sentry/utils/performance/histogram/histogramQuery';

function renderHistogram({isLoading, error, histograms}) {
  if (isLoading) {
    return 'loading';
  }
  if (error !== null) {
    return 'error';
  }
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

describe('HistogramQuery', function () {
  let eventView, location;
  beforeEach(function () {
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

    render(
      <HistogramQuery
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

    expect(await screen.findByText('measurements.fp')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(getMock).toHaveBeenCalledTimes(1);
  });
});
