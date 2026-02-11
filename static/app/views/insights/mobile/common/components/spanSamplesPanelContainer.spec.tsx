import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SpanSamplesContainer} from 'sentry/views/insights/mobile/common/components/spanSamplesPanelContainer';
import {ModuleName} from 'sentry/views/insights/types';

describe('SpanSamplesContainer', () => {
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
    render(
      <SpanSamplesContainer
        groupId="123"
        moduleName={ModuleName.CACHE}
        transactionName="GET /api/v1/cache"
        transactionMethod="GET"
        release="1.0.0"
        searchQueryKey="cache"
        spanOp="GET"
        additionalFilters={{}}
      />
    );

    expect(await screen.findByLabelText('Create a search query')).toBeInTheDocument();
  });
});
