import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import EventView from 'app/utils/discover/eventView';
import SuspectSpansQuery from 'app/utils/performance/suspectSpans/suspectSpansQuery';
import {
  SpanSortOthers,
  SpanSortPercentiles,
} from 'app/views/performance/transactionSummary/transactionSpans/types';

describe('SuspectSpansQuery', function () {
  let eventView, location;
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
    // @ts-expect-error
    const getMock = MockApiClient.addMockResponse({
      url: '/organizations/test-org/events-spans-performance/',
      // just asserting that the data is being fetched, no need for actual data here
      body: [],
    });

    mountWithTheme(
      <SuspectSpansQuery location={location} orgSlug="test-org" eventView={eventView}>
        {() => null}
      </SuspectSpansQuery>
    );

    expect(getMock).toHaveBeenCalledTimes(1);
  });
});
