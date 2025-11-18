import {MetricDetectorFixture} from 'sentry-fixture/detectors';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {MetricDetectorDetailsChart} from 'sentry/views/detectors/components/details/metric/chart';

describe('MetricDetectorDetailsChart', () => {
  const detector = MetricDetectorFixture();
  const snubaQuery = detector.dataSources[0].queryObj.snubaQuery;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/open-periods/',
      body: [],
    });
  });

  it('displays error alert and error panel when API request fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events-stats/`,
      body: {
        detail: 'Invalid query: xyz',
      },
      statusCode: 400,
    });

    render(<MetricDetectorDetailsChart detector={detector} snubaQuery={snubaQuery} />);

    expect(await screen.findByText('Invalid query: xyz')).toBeInTheDocument();
    expect(screen.getByText('Error loading chart data')).toBeInTheDocument();
  });
});
