import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

import {getReplayTraceSearchQuery} from './replayTraceSearch';
import {useReplayTraceMeta} from './useReplayTraceMeta';

jest.mock('sentry/utils/useSyncedLocalStorageState', () => ({
  useSyncedLocalStorageState: jest.fn(),
}));

const organization = OrganizationFixture();
const replayRecord = ReplayRecordFixture();
const replayTraceQuery = getReplayTraceSearchQuery(replayRecord.id);

describe('useReplayTraceMeta', () => {
  beforeEach(() => {
    jest.mocked(useSyncedLocalStorageState).mockReturnValue(['non-eap', jest.fn()]);
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
      url: '/organizations/org-slug/events-trace-meta/trace1/',
      body: {
        errors: 1,
        performance_issues: 2,
        projects: 1,
        transactions: 3,
        transaction_child_count_map: [],
        span_count: 4,
        span_count_map: {
          op1: 4,
        },
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
      errors: 1,
      performance_issues: 2,
      projects: 1,
      transactions: 3,
      transaction_child_count_map: {},
      span_count: 4,
      span_count_map: {
        op1: 4,
      },
    });
  });
});
