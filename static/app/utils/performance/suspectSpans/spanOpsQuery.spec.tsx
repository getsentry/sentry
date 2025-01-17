import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import EventView from 'sentry/utils/discover/eventView';
import SpanOpsQuery from 'sentry/utils/performance/suspectSpans/spanOpsQuery';
import {
  SpanSortOthers,
  SpanSortPercentiles,
} from 'sentry/views/performance/transactionSummary/transactionSpans/types';

describe('SuspectSpansQuery', function () {
  let eventView: any, location: any;
  beforeEach(function () {
    eventView = EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: [...Object.values(SpanSortOthers), ...Object.values(SpanSortPercentiles)],
      projects: [],
      environment: [],
    });
    location = {
      pathname: '/',
      query: {},
    };
  });

  it('fetches data on mount', async function () {
    const getMock = MockApiClient.addMockResponse({
      url: '/organizations/test-org/events-span-ops/',
      // just asserting that the data is being fetched, no need for actual data here
      body: [],
    });

    render(
      <SpanOpsQuery location={location} orgSlug="test-org" eventView={eventView}>
        {() => null}
      </SpanOpsQuery>
    );

    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));
  });
});
