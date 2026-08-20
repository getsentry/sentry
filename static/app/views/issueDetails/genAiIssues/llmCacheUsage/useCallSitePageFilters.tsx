import {useMemo} from 'react';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';

import type {LlmCacheEvidenceData} from './types';
import {getCallSiteWindow} from './utils';

/**
 * Page filters pinned to the window the finding was derived from.
 *
 * The reader's own selection would silently answer a different question than
 * the issue is making a claim about, so live queries on this page ignore it.
 * The date range comes from the detection window, and the environment is
 * cleared because the detector applied none -- narrowed to one, the chart would
 * show a slice of the traffic the finding was measured over, and this page
 * renders no filter bar to explain why. `padDays` widens the range so a chart
 * can show what the call site looked like before detection.
 */
export function useCallSitePageFilters(
  evidenceData: LlmCacheEvidenceData,
  {padDays = 0}: {padDays?: number} = {}
): PageFilters | undefined {
  const {selection} = usePageFilters();
  const window = getCallSiteWindow(evidenceData);
  const windowStart = window?.start.valueOf() ?? null;
  const windowEnd = window?.end.valueOf() ?? null;

  return useMemo(() => {
    if (windowStart === null || windowEnd === null) {
      return;
    }

    const start = new Date(windowStart);
    const end = new Date(windowEnd);
    start.setDate(start.getDate() - padDays);
    // Padded forward as well as back, so the range can reach past detection and
    // show whether a fix took. Clamped to now because a range ending in the
    // future would draw a run of empty buckets after the real data.
    end.setDate(end.getDate() + padDays);
    const now = new Date();
    if (end > now) {
      end.setTime(now.getTime());
    }

    return {
      ...selection,
      environments: [],
      datetime: {start, end, period: null, utc: true},
    };
  }, [selection, windowStart, windowEnd, padDays]);
}
