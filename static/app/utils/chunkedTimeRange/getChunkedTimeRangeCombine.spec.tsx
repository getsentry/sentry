import type {UseQueryResult} from '@tanstack/react-query';

import {getChunkedTimeRangeCombine} from 'sentry/utils/chunkedTimeRange/getChunkedTimeRangeCombine';

// Minimal query-result fakes — the combine fn only reads these fields.
function success<T>(data: T): UseQueryResult<T> {
  return {
    isSuccess: true,
    isError: false,
    isPending: false,
    fetchStatus: 'idle',
    data,
    error: null,
  } as unknown as UseQueryResult<T>;
}
function loading<T>(): UseQueryResult<T> {
  return {
    isSuccess: false,
    isError: false,
    isPending: true,
    fetchStatus: 'fetching',
    data: undefined,
    error: null,
  } as unknown as UseQueryResult<T>;
}
function failed<T>(error: Error): UseQueryResult<T> {
  return {
    isSuccess: false,
    isError: true,
    isPending: false,
    fetchStatus: 'idle',
    data: undefined,
    error,
  } as unknown as UseQueryResult<T>;
}

const RESOLVED = {
  chunks: [
    {start: 0, end: 10},
    {start: 10, end: 20},
  ],
  chunked: true,
  isRelative: false,
  fullRange: {start: 0, end: 20},
  intervalMs: 10,
};

// merge = flatten every chunk's rows.
const combine = getChunkedTimeRangeCombine({
  ...RESOLVED,
  merge: (responses: number[][]) => responses.flat(),
});

describe('getChunkedTimeRangeCombine', () => {
  it('merges the succeeded results', () => {
    const out = combine([success([1, 2]), success([3])]);
    expect(out.data).toEqual([1, 2, 3]);
    expect(out.isPending).toBe(false);
    expect(out.isPartial).toBe(false);
    expect(out.isFetchingMore).toBe(false);
  });

  it('is pending with nothing resolved and no error', () => {
    const out = combine([loading(), loading()]);
    expect(out.data).toBeUndefined();
    expect(out.isPending).toBe(true);
  });

  it('flags fetchingMore while some chunks stream in', () => {
    const out = combine([success([1]), loading()]);
    expect(out.data).toEqual([1]);
    expect(out.isFetchingMore).toBe(true);
    expect(out.isPending).toBe(false);
  });

  it('flags partial and keeps survivors when a chunk errors', () => {
    const out = combine([success([1]), failed(new Error('boom'))]);
    expect(out.data).toEqual([1]);
    expect(out.isPartial).toBe(true);
    expect(out.error).toBeNull();
  });

  it('surfaces a fatal error only when every chunk fails', () => {
    const err = new Error('boom');
    const out = combine([failed(err), failed(new Error('other'))]);
    expect(out.error).toBe(err);
    expect(out.data).toBeUndefined();
    expect(out.isPending).toBe(false);
  });
});
