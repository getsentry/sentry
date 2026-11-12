import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {NewTraceView} from './trace';

const PAGE_LINKS =
  '<https://sentry.io/fake/previous>; rel="previous"; results="false"; cursor="0:0:1", ' +
  '<https://sentry.io/fake/next>; rel="next"; results="false"; cursor="0:20:0"';

describe('NewTraceView', () => {
  const organization = OrganizationFixture();
  const replayRecord = ReplayRecordFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      headers: {Link: PAGE_LINKS},
      body: {data: [{trace: 'trace1', 'min(precise.start_ts)': 1}]},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-meta/trace1/',
      body: {},
    });
    MockApiClient.addMockResponse({url: '/customers/org-slug/', body: {}});
  });

  it('requests the status attributes needed to flag errored spans', async () => {
    const traceRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace/trace1/',
      body: [],
    });

    render(<NewTraceView replay={replayRecord} />, {organization});

    await waitFor(() => expect(traceRequest).toHaveBeenCalled());

    expect(traceRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/trace/trace1/',
      expect.objectContaining({
        query: expect.objectContaining({
          additional_attributes: ['http.response.status_code', 'span.status'],
        }),
      })
    );
  });
});
