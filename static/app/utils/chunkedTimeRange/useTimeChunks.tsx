import {useMemo} from 'react';
import moment from 'moment-timezone';

import {getDiffInMinutes} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import {
  computeTimeChunks,
  type TimeChunk,
  type TimeChunkPolicy,
} from 'sentry/utils/chunkedTimeRange/computeTimeChunks';
import {defined} from 'sentry/utils/defined';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';

export interface TimeRange {
  end: number;
  start: number;
}

export interface ResolvedTimeChunks {
  /**
   * True when the range was split into more than one chunk.
   */
  chunked: boolean;
  /**
   * The chunks, newest-first.
   */
  chunks: TimeChunk[];
  /**
   * The full aligned range spanned by every chunk (not just loaded ones).
   */
  fullRange: TimeRange;
  intervalMs: number;
  /**
   * True when the page filter is a relative period (so the newest chunk is the
   * live edge).
   */
  isRelative: boolean;
}

/**
 * Resolves a page-filter selection + interval into a stable set of epoch-aligned
 * chunks, ready to feed into `getChunkedTimeRangeQueries`.
 *
 * This stays a hook (rather than a plain `apiOptions`-style helper) only because
 * it must resolve a relative range against `Date.now()` and keep that anchor
 * stable across renders: the range is resolved once per filter/interval change,
 * and epoch-snapping keeps historical boundaries fixed so only the live edge
 * moves. It builds no queries itself.
 *
 * Pass `interval: null` to disable it (returns empty / `chunked: false`), which
 * is how a caller gates the whole thing off before dimensions are known.
 */
export function useTimeChunks({
  selection,
  interval,
  policy,
}: {
  selection: PageFilters;
  interval?: string | null;
  policy?: TimeChunkPolicy;
}): ResolvedTimeChunks {
  return useMemo(() => {
    const empty: ResolvedTimeChunks = {
      chunks: [],
      chunked: false,
      isRelative: false,
      fullRange: {start: 0, end: 0},
      intervalMs: 0,
    };
    if (!defined(interval)) {
      return empty;
    }
    const intervalMs = intervalToMilliseconds(interval);
    if (intervalMs <= 0) {
      return empty;
    }

    const normalized = normalizeDateTimeParams(selection.datetime);
    let start: number;
    let end: number;
    let isRelative: boolean;
    if (defined(normalized.start) && defined(normalized.end)) {
      // normalizeDateTimeParams emits UTC strings without a `Z`, so parse them
      // as UTC (not local) to get the correct epoch ms.
      start = moment.utc(normalized.start).valueOf();
      end = moment.utc(normalized.end).valueOf();
      isRelative = false;
    } else {
      end = Date.now();
      start = end - getDiffInMinutes(selection.datetime) * 60 * 1000;
      isRelative = true;
    }

    const chunks = computeTimeChunks({start, end, interval, policy});
    return {
      chunks,
      chunked: chunks.length > 1,
      isRelative,
      intervalMs,
      fullRange: {
        start: chunks.length ? Math.min(...chunks.map(c => c.start)) : 0,
        end: chunks.length ? Math.max(...chunks.map(c => c.end)) : 0,
      },
    };
    // Date.now() is intentionally captured once per filter/interval change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selection.datetime.start,
    selection.datetime.end,
    selection.datetime.period,
    selection.datetime.utc,
    interval,
    policy?.initialBuckets,
    policy?.growthFactor,
    policy?.maxChunks,
    policy?.minBucketsToChunk,
  ]);
}
