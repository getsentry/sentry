import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';

import {useUserSessions} from './useUserSessions';

jest.mock('sentry/components/pageFilters/usePageFilters');

const A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

// 2024-01-01T00:00:00Z in each dataset's own representation.
const EPOCH_MS = 1704067200000;
const EPOCH_NANOS = EPOCH_MS * 1e6;
const EPOCH_SECS = EPOCH_MS / 1e3;

function mockDataset(dataset: string, phase: 'discovery' | 'counts', data: unknown[]) {
  return MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    method: 'GET',
    body: {data, meta: {fields: {}}},
    match: [
      (_url: string, options: Record<string, any>) =>
        options.query.dataset === dataset &&
        (phase === 'discovery'
          ? options.query.query === 'has:session.id'
          : options.query.query.startsWith('session.id:[')),
    ],
  });
}

describe('useUserSessions', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());
  });

  it('merges per-dataset counts for a session that only one dataset discovered', async () => {
    // Discovery: only the spans query surfaces session B. If the merge relied on
    // discovery alone, B's log count would render as 0.
    mockDataset('logs', 'discovery', [
      {
        'session.id': A,
        'count()': 3,
        'min(timestamp_precise)': EPOCH_NANOS,
        'max(timestamp_precise)': EPOCH_NANOS + 5_000 * 1e6,
      },
    ]);
    mockDataset('spans', 'discovery', [
      {
        'session.id': B,
        'count()': 7,
        'min(precise.start_ts)': EPOCH_SECS + 60,
        'max(precise.finish_ts)': EPOCH_SECS + 90,
      },
    ]);
    mockDataset('tracemetrics', 'discovery', []);
    mockDataset('errors', 'discovery', []);

    // Counts phase: every dataset now reports on both sessions.
    const logCounts = mockDataset('logs', 'counts', [
      {
        'session.id': A,
        'count()': 3,
        'min(timestamp_precise)': EPOCH_NANOS,
        'max(timestamp_precise)': EPOCH_NANOS + 5_000 * 1e6,
      },
      {
        'session.id': B,
        'count()': 11,
        'min(timestamp_precise)': EPOCH_NANOS + 50 * 1e9,
        'max(timestamp_precise)': EPOCH_NANOS + 95 * 1e9,
      },
    ]);
    mockDataset('spans', 'counts', [
      {
        'session.id': B,
        'count()': 7,
        'min(precise.start_ts)': EPOCH_SECS + 60,
        'max(precise.finish_ts)': EPOCH_SECS + 90,
      },
    ]);
    mockDataset('tracemetrics', 'counts', [
      {
        'session.id': A,
        'count(session.id)': 2,
        'min(timestamp_precise)': EPOCH_NANOS,
        'max(timestamp_precise)': EPOCH_NANOS,
      },
    ]);
    mockDataset('errors', 'counts', [
      {
        'session.id': A,
        'count()': 1,
        'min(timestamp)': '2024-01-01T00:00:10+00:00',
        'max(timestamp)': '2024-01-01T00:00:10+00:00',
      },
    ]);

    const {result} = renderHookWithProviders(() => useUserSessions());

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(logCounts).toHaveBeenCalled();
    expect(result.current.sessions).toHaveLength(2);

    // B is more recent (last seen +95s vs A's +10s), so it leads.
    const [first, second] = result.current.sessions;
    expect(first!.id).toBe(B);
    expect(second!.id).toBe(A);

    // The log count for B came only from the counts phase.
    expect(first!.counts).toEqual({
      logs: 11,
      metrics: 0,
      spans: 7,
      errors: 0,
    });
    expect(first!.totalEvents).toBe(18);

    expect(second!.counts).toEqual({
      logs: 3,
      metrics: 2,
      spans: 0,
      errors: 1,
    });
    expect(second!.totalEvents).toBe(6);
  });

  it('normalizes each dataset timestamp representation into epoch ms', async () => {
    mockDataset('logs', 'discovery', [
      {
        'session.id': A,
        'count()': 1,
        'min(timestamp_precise)': EPOCH_NANOS,
        'max(timestamp_precise)': EPOCH_NANOS,
      },
    ]);
    mockDataset('spans', 'discovery', []);
    mockDataset('tracemetrics', 'discovery', []);
    mockDataset('errors', 'discovery', []);

    mockDataset('logs', 'counts', [
      {
        'session.id': A,
        'count()': 1,
        'min(timestamp_precise)': EPOCH_NANOS,
        'max(timestamp_precise)': EPOCH_NANOS,
      },
    ]);
    // spans reports seconds; it should widen the window on both ends.
    mockDataset('spans', 'counts', [
      {
        'session.id': A,
        'count()': 1,
        'min(precise.start_ts)': EPOCH_SECS - 30,
        'max(precise.finish_ts)': EPOCH_SECS + 30,
      },
    ]);
    mockDataset('tracemetrics', 'counts', []);
    // errors reports an ISO string.
    mockDataset('errors', 'counts', [
      {
        'session.id': A,
        'count()': 1,
        'min(timestamp)': '2024-01-01T00:00:00+00:00',
        'max(timestamp)': '2024-01-01T00:01:00+00:00',
      },
    ]);

    const {result} = renderHookWithProviders(() => useUserSessions());

    await waitFor(() => expect(result.current.isPending).toBe(false));

    const [session] = result.current.sessions;
    expect(session!.firstSeen).toBe(EPOCH_MS - 30_000);
    expect(session!.lastSeen).toBe(EPOCH_MS + 60_000);
  });

  it('tolerates a dataset that reports no usable timestamp', async () => {
    // tracemetrics can return null precise timestamps; the row must still render.
    mockDataset('logs', 'discovery', []);
    mockDataset('spans', 'discovery', []);
    mockDataset('tracemetrics', 'discovery', [
      {
        'session.id': A,
        'count(session.id)': 4,
        'min(timestamp_precise)': null,
        'max(timestamp_precise)': null,
      },
    ]);
    mockDataset('errors', 'discovery', []);

    mockDataset('logs', 'counts', []);
    mockDataset('spans', 'counts', []);
    mockDataset('tracemetrics', 'counts', [
      {
        'session.id': A,
        'count(session.id)': 4,
        'min(timestamp_precise)': null,
        'max(timestamp_precise)': null,
      },
    ]);
    mockDataset('errors', 'counts', []);

    const {result} = renderHookWithProviders(() => useUserSessions());

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.sessions).toEqual([
      {
        id: A,
        counts: {logs: 0, metrics: 4, spans: 0, errors: 0},
        firstSeen: undefined,
        lastSeen: undefined,
        totalEvents: 4,
      },
    ]);
  });

  it('skips the counts phase when discovery finds nothing', async () => {
    mockDataset('logs', 'discovery', []);
    mockDataset('spans', 'discovery', []);
    mockDataset('tracemetrics', 'discovery', []);
    mockDataset('errors', 'discovery', []);
    const counts = mockDataset('logs', 'counts', []);

    const {result} = renderHookWithProviders(() => useUserSessions());

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.sessions).toEqual([]);
    expect(counts).not.toHaveBeenCalled();
  });
});
