import {useMemo} from 'react';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';

import type {LlmCacheEvidenceData} from './types';

/**
 * Page filters pinned to the window the finding was derived from.
 *
 * The reader's own date selection would silently answer a different question
 * than the issue is making a claim about, so live queries on this page ignore
 * it and use the detection window instead. `padDays` widens the range so a
 * chart can show what the call site looked like before detection.
 */
export function useCallSitePageFilters(
  evidenceData: LlmCacheEvidenceData,
  {padDays = 0}: {padDays?: number} = {}
): PageFilters | undefined {
  const {selection} = usePageFilters();
  const {windowStart, windowEnd} = evidenceData;

  return useMemo(() => {
    if (windowStart === null || windowEnd === null) {
      return;
    }

    const start = new Date(windowStart);
    const end = new Date(windowEnd);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
      return;
    }
    start.setDate(start.getDate() - padDays);

    return {
      ...selection,
      datetime: {start, end, period: null, utc: true},
    };
  }, [selection, windowStart, windowEnd, padDays]);
}
