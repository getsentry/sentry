import {render, screen} from 'sentry-test/reactTestingLibrary';

import {CacheSamplePanel} from 'sentry/views/insights/cache/components/samplePanel';

describe('CacheSamplePanel', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      method: 'GET',
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events-timeseries/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: {
        data: [],
      },
    });
  });

  // Adding in just a very basic test to ensure the panel renders without errors
  it('should render search query builder', async () => {
    render(<CacheSamplePanel />);

    expect(await screen.findByLabelText('Create a search query')).toBeInTheDocument();
  });
});
