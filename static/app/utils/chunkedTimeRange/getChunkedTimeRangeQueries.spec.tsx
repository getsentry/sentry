import {apiOptions} from 'sentry/utils/api/apiOptions';
import {computeTimeChunks} from 'sentry/utils/chunkedTimeRange/computeTimeChunks';
import {
  getChunkedTimeRangeQueries,
  type ChunkQueryContext,
} from 'sentry/utils/chunkedTimeRange/getChunkedTimeRangeQueries';

const HOUR = 60 * 60 * 1000;
// 3 chunks (15, 45, 100 hours), newest-first.
const CHUNKS = computeTimeChunks({start: 0, end: 160 * HOUR, interval: '1h'});

function resolved(overrides = {}) {
  return {
    chunks: CHUNKS,
    chunked: true,
    isRelative: true,
    fullRange: {start: 0, end: 160 * HOUR},
    intervalMs: HOUR,
    ...overrides,
  };
}

function buildStubQuery({chunk}: ChunkQueryContext) {
  return apiOptions.as<number[]>()('/organizations/$organizationIdOrSlug/events/', {
    path: {organizationIdOrSlug: 'org-slug'},
    query: {window: `${chunk.start}`},
    staleTime: 0,
  });
}

describe('getChunkedTimeRangeQueries', () => {
  it('builds one query per chunk', () => {
    const build = jest.fn(buildStubQuery);
    const queries = getChunkedTimeRangeQueries({...resolved(), buildChunkQuery: build});

    expect(queries).toHaveLength(CHUNKS.length);
    expect(build).toHaveBeenCalledTimes(CHUNKS.length);
  });

  it('marks only the newest chunk of a relative range as the live edge', () => {
    const build = jest.fn(buildStubQuery);
    getChunkedTimeRangeQueries({...resolved({isRelative: true}), buildChunkQuery: build});

    const trailing = build.mock.calls.map(([context]) => context.isTrailingLive);
    expect(trailing).toEqual([true, false, false]);
  });

  it('never marks a live edge for absolute ranges', () => {
    const build = jest.fn(buildStubQuery);
    getChunkedTimeRangeQueries({
      ...resolved({isRelative: false}),
      buildChunkQuery: build,
    });

    expect(build.mock.calls.every(([context]) => !context.isTrailingLive)).toBe(true);
  });

  it('attaches a default retry and honors an override', () => {
    const withDefault = getChunkedTimeRangeQueries({
      ...resolved(),
      buildChunkQuery: buildStubQuery,
    });
    expect(typeof withDefault[0]!.retry).toBe('function');

    const customRetry = () => false;
    const withOverride = getChunkedTimeRangeQueries({
      ...resolved(),
      buildChunkQuery: buildStubQuery,
      retry: customRetry,
    });
    expect(withOverride[0]!.retry).toBe(customRetry);
  });
});
