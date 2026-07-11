import {useQueries} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {computeTimeChunks} from 'sentry/utils/chunkedTimeRange/computeTimeChunks';
import {
  getChunkedTimeRangeQueries,
  type ChunkQueryContext,
} from 'sentry/utils/chunkedTimeRange/getChunkedTimeRangeQueries';
import {useChunkedTimeRangeResults} from 'sentry/utils/chunkedTimeRange/useChunkedTimeRangeResults';

const organization = OrganizationFixture();

interface Row {
  value: number;
  window: string;
}

const HOUR = 60 * 60 * 1000;
const CHUNKS = computeTimeChunks({start: 0, end: 160 * HOUR, interval: '1h'});
const RESOLVED = {
  chunks: CHUNKS,
  chunked: true,
  isRelative: false,
  fullRange: {start: 0, end: 160 * HOUR},
  intervalMs: HOUR,
};

function buildChunkQuery({chunk}: ChunkQueryContext) {
  return apiOptions.as<Row[]>()('/organizations/$organizationIdOrSlug/events/', {
    path: {organizationIdOrSlug: organization.slug},
    query: {window: `${chunk.start}-${chunk.end}`},
    staleTime: Infinity,
  });
}

// Merge = flatten every chunk's rows, sorted by value. Module-scope so its
// reference is stable across renders (the memo dependency contract).
function merge(responses: Row[][]) {
  return responses.flat().sort((a, b) => a.value - b.value);
}

// A tiny consumer that wires the three pieces the way a real caller does.
function useTestChunked() {
  const queries = getChunkedTimeRangeQueries({...RESOLVED, buildChunkQuery});
  const results = useQueries({queries});
  return useChunkedTimeRangeResults({...RESOLVED, results, merge});
}

function mockChunk(chunk: {end: number; start: number}, value: number, statusCode = 200) {
  return MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    method: 'GET',
    match: [MockApiClient.matchQuery({window: `${chunk.start}-${chunk.end}`})],
    body: statusCode === 200 ? [{window: 'w', value}] : {detail: 'boom'},
    statusCode,
  });
}

describe('useChunkedTimeRangeResults', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('merges the chunk responses once they resolve', async () => {
    const mocks = CHUNKS.map((chunk, i) => mockChunk(chunk, i + 1));

    const {result} = renderHookWithProviders(useTestChunked);

    await waitFor(() => expect(result.current.data).toHaveLength(CHUNKS.length));
    for (const mock of mocks) {
      expect(mock).toHaveBeenCalled();
    }
    expect(result.current.data?.map(r => r.value)).toEqual([1, 2, 3]);
    expect(result.current.isPending).toBe(false);
    expect(result.current.isPartial).toBe(false);
  });

  it('flags partial and keeps the survivors when a chunk fails', async () => {
    CHUNKS.forEach((chunk, i) =>
      mockChunk(chunk, i + 1, i === CHUNKS.length - 1 ? 500 : 200)
    );

    const {result} = renderHookWithProviders(useTestChunked);

    await waitFor(() => expect(result.current.isPartial).toBe(true));
    expect(result.current.data).toHaveLength(CHUNKS.length - 1);
    expect(result.current.error).toBeNull();
  });

  it('surfaces a fatal error only when every chunk fails', async () => {
    CHUNKS.forEach(chunk => mockChunk(chunk, 0, 500));

    const {result} = renderHookWithProviders(useTestChunked);

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(false);
  });
});
