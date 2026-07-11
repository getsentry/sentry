import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {computeTimeChunks} from 'sentry/utils/chunkedTimeRange/computeTimeChunks';
import {
  useChunkedTimeRangeQuery,
  type ChunkQueryContext,
} from 'sentry/utils/chunkedTimeRange/useChunkedTimeRangeQuery';

const organization = OrganizationFixture();

interface Row {
  value: number;
  window: string;
}

const HOUR = 60 * 60 * 1000;
// 3 chunks: 15, 45, 100 hours (newest-first).
const CHUNKS = computeTimeChunks({start: 0, end: 160 * HOUR, interval: '1h'});

function buildChunkQuery({chunk}: ChunkQueryContext) {
  return apiOptions.as<Row[]>()('/organizations/$organizationIdOrSlug/events/', {
    path: {organizationIdOrSlug: organization.slug},
    query: {window: `${chunk.start}-${chunk.end}`},
    staleTime: Infinity,
  });
}

// Merge = flatten every chunk's rows, sorted by value.
function merge(responses: Row[][]) {
  return responses.flat().sort((a, b) => a.value - b.value);
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

function renderChunked(overrides = {}) {
  const resolved = {
    chunks: CHUNKS,
    chunked: CHUNKS.length > 1,
    isRelative: false,
    fullRange: {start: 0, end: 160 * HOUR},
    intervalMs: HOUR,
  };
  return renderHookWithProviders(() =>
    useChunkedTimeRangeQuery({...resolved, buildChunkQuery, merge, ...overrides})
  );
}

describe('useChunkedTimeRangeQuery', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('fires one query per chunk and merges the responses', async () => {
    const mocks = CHUNKS.map((chunk, i) => mockChunk(chunk, i + 1));

    const {result} = renderChunked();

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

    const {result} = renderChunked();

    await waitFor(() => expect(result.current.isPartial).toBe(true));
    expect(result.current.data).toHaveLength(CHUNKS.length - 1);
    expect(result.current.error).toBeNull();
  });

  it('surfaces a fatal error only when every chunk fails', async () => {
    CHUNKS.forEach(chunk => mockChunk(chunk, 0, 500));

    const {result} = renderChunked();

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(false);
  });
});
