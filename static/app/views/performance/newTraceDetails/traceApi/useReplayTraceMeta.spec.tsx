import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {getReplayTraceSearchQuery} from './replayTraceSearch';
import {useReplayTraceMeta} from './useReplayTraceMeta';

const organization = OrganizationFixture();
const replayRecord = ReplayRecordFixture();
const replayTraceQuery = getReplayTraceSearchQuery(replayRecord.id);

describe('useReplayTraceMeta', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries replay traces from the spans dataset using canonical and legacy replay ids', async () => {
    const eventsRequest = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            trace: 'trace1',
            'min(precise.start_ts)': 1,
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/trace-meta/trace1/',
      body: {
        errorsCount: 1,
        logsCount: 0,
        metricsCount: 0,
        performanceIssuesCount: 2,
        spansCount: 4,
        spansCountMap: {
          op1: 4,
        },
        transactionChildCountMap: [],
        uptimeCount: 0,
      },
    });

    const {result} = renderHookWithProviders(() => useReplayTraceMeta(replayRecord), {
      organization,
    });

    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(eventsRequest).toHaveBeenCalledTimes(1);
    expect(eventsRequest.mock.calls[0]![1].query).toMatchObject({
      dataset: 'spans',
      field: ['trace', 'min(precise.start_ts)'],
      query: replayTraceQuery,
      referrer: 'api.replays.replay-trace-meta',
      sort: ['min_precise_start_ts', 'trace'],
    });
    expect(result.current.data).toEqual({
      errorsCount: 1,
      logsCount: 0,
      metricsCount: 0,
      performanceIssuesCount: 2,
      spansCount: 4,
      spansCountMap: {
        op1: 4,
      },
      transactionChildCountMap: {},
      uptimeCount: 0,
    });
  });
});
