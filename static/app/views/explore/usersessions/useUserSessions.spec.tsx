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

function mockDataset(
  dataset: string,
  phase: 'discovery' | 'counts',
  data: unknown[],
  discoveryQuery = 'has:session.id'
) {
  return MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    method: 'GET',
    body: {data, meta: {fields: {}}},
    match: [
      (_url: string, options: Record<string, any>) =>
        options.query.dataset === dataset &&
        (phase === 'discovery'
          ? options.query.query === discoveryQuery
          : options.query.query.startsWith('session.id:[')),
    ],
  });
}

function mockAllDatasets(phase: 'discovery' | 'counts') {
  return ['logs', 'spans', 'tracemetrics', 'errors'].map(dataset =>
    mockDataset(dataset, phase, [])
  );
}

/** What {@link resolveSessionName} produces when nothing identified the session. */
const ANONYMOUS_NAME = {
  handle: 'aaaaaaaa',
  subject: 'Anonymous',
  subjectKind: 'unknown',
  context: undefined,
  release: undefined,
  user: undefined,
};

const KNOWN_KEYS = {
  logs: new Set(['message', 'user.id']),
  metrics: new Set(['metric.name']),
  traces: new Set(['span.op', 'user.id']),
  errors: new Set(['level', 'user.id']),
};

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
        'count_unique(trace)': 7,
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
        'count_unique(trace)': 7,
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
      traces: 7,
      errors: 0,
    });
    expect(first!.totalEvents).toBe(18);

    expect(second!.counts).toEqual({
      logs: 3,
      metrics: 2,
      traces: 0,
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
        'count_unique(trace)': 1,
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
        counts: {logs: 0, metrics: 4, traces: 0, errors: 0},
        firstSeen: undefined,
        lastSeen: undefined,
        totalEvents: 4,
        // Metrics has no any() aggregate, so nothing could name this session.
        name: ANONYMOUS_NAME,
      },
    ]);
  });

  it('names a session from whichever dataset carries each attribute', async () => {
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
    // Spans has the device context but the session was still anonymous there,
    // and its email came back scrubbed.
    mockDataset('spans', 'counts', [
      {
        'session.id': A,
        'count_unique(trace)': 1,
        'min(precise.start_ts)': EPOCH_SECS,
        'max(precise.finish_ts)': EPOCH_SECS,
        'any(user.email)': '[Filtered]',
        'any(browser.name)': 'Chrome',
        'any(os.name)': 'macOS',
      },
    ]);
    mockDataset('tracemetrics', 'counts', []);
    // Errors is the only dataset that knows who this was.
    mockDataset('errors', 'counts', [
      {
        'session.id': A,
        'count()': 1,
        'min(timestamp)': '2024-01-01T00:00:00+00:00',
        'max(timestamp)': '2024-01-01T00:00:00+00:00',
        'any(user.email)': 'lukas@example.com',
        'any(release)': '1.2.3',
      },
    ]);

    const {result} = renderHookWithProviders(() => useUserSessions());

    await waitFor(() => expect(result.current.isPending).toBe(false));

    // The email had to come from errors, the context from spans, and the
    // scrubbed value on spans must not have won the email slot.
    expect(result.current.sessions[0]!.name).toEqual({
      handle: 'aaaaaaaa',
      subject: 'lukas@example.com',
      subjectKind: 'user',
      context: 'Chrome · macOS',
      release: '1.2.3',
      user: {
        email: 'lukas@example.com',
        id: '',
        ip_address: '',
        username: '',
        name: '',
      },
    });
  });

  it('skips the counts phase when discovery finds nothing', async () => {
    mockAllDatasets('discovery');
    const counts = mockDataset('logs', 'counts', []);

    const {result} = renderHookWithProviders(() => useUserSessions());

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.sessions).toEqual([]);
    expect(counts).not.toHaveBeenCalled();
  });

  describe('with a search query', () => {
    it('only queries the datasets that know every key in the query', async () => {
      const query = 'span.op:pageload';
      const discoveryQuery = 'has:session.id (span.op:pageload)';

      const spanDiscovery = mockDataset(
        'spans',
        'discovery',
        [
          {
            'session.id': A,
            'count()': 7,
            'min(precise.start_ts)': EPOCH_SECS,
            'max(precise.finish_ts)': EPOCH_SECS + 30,
          },
        ],
        discoveryQuery
      );
      const logDiscovery = mockDataset('logs', 'discovery', [], discoveryQuery);

      // Counts stay unfiltered: the filter selects sessions, it does not redefine
      // what a session contains.
      const logCounts = mockDataset('logs', 'counts', [
        {
          'session.id': A,
          'count()': 42,
          'min(timestamp_precise)': EPOCH_NANOS,
          'max(timestamp_precise)': EPOCH_NANOS + 30 * 1e9,
        },
      ]);
      mockDataset('spans', 'counts', [
        {
          'session.id': A,
          'count_unique(trace)': 7,
          'min(precise.start_ts)': EPOCH_SECS,
          'max(precise.finish_ts)': EPOCH_SECS + 30,
        },
      ]);
      mockDataset('tracemetrics', 'counts', []);
      mockDataset('errors', 'counts', []);

      const {result} = renderHookWithProviders(() =>
        useUserSessions({query, knownKeys: KNOWN_KEYS})
      );

      await waitFor(() => expect(result.current.isPending).toBe(false));

      expect(spanDiscovery).toHaveBeenCalled();
      // `span.op` is meaningless to logs, so logs is never asked.
      expect(logDiscovery).not.toHaveBeenCalled();

      expect(logCounts).toHaveBeenCalled();
      expect(result.current.sessions).toEqual([
        {
          id: A,
          counts: {logs: 42, metrics: 0, traces: 7, errors: 0},
          firstSeen: EPOCH_MS,
          lastSeen: EPOCH_MS + 30_000,
          totalEvents: 49,
          name: ANONYMOUS_NAME,
        },
      ]);
    });

    it('unions candidates across every dataset that knows a shared key', async () => {
      const discoveryQuery = 'has:session.id (user.id:123)';

      const logDiscovery = mockDataset(
        'logs',
        'discovery',
        [
          {
            'session.id': A,
            'count()': 1,
            'min(timestamp_precise)': EPOCH_NANOS,
            'max(timestamp_precise)': EPOCH_NANOS,
          },
        ],
        discoveryQuery
      );
      const spanDiscovery = mockDataset(
        'spans',
        'discovery',
        [
          {
            'session.id': B,
            'count()': 1,
            'min(precise.start_ts)': EPOCH_SECS,
            'max(precise.finish_ts)': EPOCH_SECS,
          },
        ],
        discoveryQuery
      );
      const errorDiscovery = mockDataset('errors', 'discovery', [], discoveryQuery);
      // `user.id` is not in the metrics key set.
      const metricDiscovery = mockDataset(
        'tracemetrics',
        'discovery',
        [],
        discoveryQuery
      );

      mockDataset('logs', 'counts', [
        {
          'session.id': A,
          'count()': 1,
          'min(timestamp_precise)': EPOCH_NANOS,
          'max(timestamp_precise)': EPOCH_NANOS,
        },
        {
          'session.id': B,
          'count()': 2,
          'min(timestamp_precise)': EPOCH_NANOS + 60 * 1e9,
          'max(timestamp_precise)': EPOCH_NANOS + 60 * 1e9,
        },
      ]);
      mockDataset('spans', 'counts', []);
      mockDataset('tracemetrics', 'counts', []);
      mockDataset('errors', 'counts', []);

      const {result} = renderHookWithProviders(() =>
        useUserSessions({query: 'user.id:123', knownKeys: KNOWN_KEYS})
      );

      await waitFor(() => expect(result.current.isPending).toBe(false));

      expect(logDiscovery).toHaveBeenCalled();
      expect(spanDiscovery).toHaveBeenCalled();
      expect(errorDiscovery).toHaveBeenCalled();
      expect(metricDiscovery).not.toHaveBeenCalled();

      // B leads on the unfiltered `lastSeen` the row displays, even though the
      // filtered discovery timestamps put A and B the other way round.
      expect(result.current.sessions.map(session => session.id)).toEqual([B, A]);
    });

    it('issues no request and finds nothing when no dataset knows the key', async () => {
      const discovery = mockAllDatasets('discovery');
      const counts = mockAllDatasets('counts');

      const {result} = renderHookWithProviders(() =>
        useUserSessions({query: 'nonsense.key:1', knownKeys: KNOWN_KEYS})
      );

      await waitFor(() => expect(result.current.isPending).toBe(false));

      expect(result.current.sessions).toEqual([]);
      expect(result.current.isError).toBe(false);
      [...discovery, ...counts].forEach(mock => expect(mock).not.toHaveBeenCalled());
    });

    it('stays pending until the key sets arrive, rather than flashing empty', () => {
      const discovery = mockAllDatasets('discovery');

      const {result} = renderHookWithProviders(() =>
        useUserSessions({
          query: 'span.op:pageload',
          knownKeys: KNOWN_KEYS,
          knownKeysLoading: true,
        })
      );

      expect(result.current.isPending).toBe(true);
      expect(result.current.sessions).toEqual([]);
      discovery.forEach(mock => expect(mock).not.toHaveBeenCalled());
    });

    it('treats one dataset failing as no matches from that dataset', async () => {
      const discoveryQuery = 'has:session.id (user.id:123)';

      mockDataset(
        'logs',
        'discovery',
        [
          {
            'session.id': A,
            'count()': 1,
            'min(timestamp_precise)': EPOCH_NANOS,
            'max(timestamp_precise)': EPOCH_NANOS,
          },
        ],
        discoveryQuery
      );
      mockDataset('errors', 'discovery', [], discoveryQuery);
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        method: 'GET',
        statusCode: 400,
        body: {detail: 'invalid query'},
        match: [
          (_url: string, options: Record<string, any>) =>
            options.query.dataset === 'spans' && options.query.query === discoveryQuery,
        ],
      });

      mockDataset('logs', 'counts', [
        {
          'session.id': A,
          'count()': 1,
          'min(timestamp_precise)': EPOCH_NANOS,
          'max(timestamp_precise)': EPOCH_NANOS,
        },
      ]);
      mockDataset('spans', 'counts', []);
      mockDataset('tracemetrics', 'counts', []);
      mockDataset('errors', 'counts', []);

      const {result} = renderHookWithProviders(() =>
        useUserSessions({query: 'user.id:123', knownKeys: KNOWN_KEYS})
      );

      await waitFor(() => expect(result.current.sessions).toHaveLength(1));

      expect(result.current.isError).toBe(false);
      expect(result.current.sessions[0]!.id).toBe(A);
    });
  });
});
