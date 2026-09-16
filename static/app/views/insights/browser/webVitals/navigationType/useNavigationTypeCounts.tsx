import {useMemo} from 'react';

import {
  NAVIGATION_TYPE_BUCKET_ORDER,
  NAVIGATION_TYPE_BUCKETS,
  NavigationTypeBucket,
} from 'sentry/views/insights/browser/webVitals/navigationType/settings';
import {Referrer} from 'sentry/views/insights/browser/webVitals/referrers';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/browser/webVitals/settings';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanFields} from 'sentry/views/insights/types';

type Props = {
  /**
   * Extra query fragment (the other active global filters) so the counts match
   * what the widgets will actually show.
   */
  additionalQuery?: string;
  enabled?: boolean;
};

export type NavigationTypeCounts = {
  counts: Record<NavigationTypeBucket, number>;
  isPending: boolean;
  /** Spans with no `browser.navigation.type` at all, counted under page loads. */
  untaggedCount: number;
};

/**
 * Counts web vital spans per navigation type bucket, so the switcher can show
 * how much data each population has before it is selected.
 */
export function useNavigationTypeCounts({
  additionalQuery,
  enabled = true,
}: Props = {}): NavigationTypeCounts {
  const search = [DEFAULT_QUERY_FILTER, additionalQuery].filter(Boolean).join(' ');

  const {data, isPending} = useSpans(
    {
      enabled,
      search,
      fields: [SpanFields.BROWSER_NAVIGATION_TYPE, 'count()'],
      sorts: [{field: 'count()', kind: 'desc'}],
      // One row per distinct navigation type, plus headroom for values the SDK
      // may add later.
      limit: 20,
    },
    Referrer.WEB_VITAL_NAVIGATION_TYPE_COUNTS
  );

  return useMemo(() => {
    const counts: Record<NavigationTypeBucket, number> = {
      [NavigationTypeBucket.PAGE_LOAD]: 0,
      [NavigationTypeBucket.SOFT_NAVIGATION]: 0,
      [NavigationTypeBucket.BFCACHE]: 0,
      [NavigationTypeBucket.PRERENDER]: 0,
    };
    let untaggedCount = 0;

    for (const row of data) {
      const value = row[SpanFields.BROWSER_NAVIGATION_TYPE];
      const count = row['count()'] ?? 0;

      if (!value) {
        untaggedCount += count;
        counts[NavigationTypeBucket.PAGE_LOAD] += count;
        continue;
      }

      const bucket = NAVIGATION_TYPE_BUCKET_ORDER.find(candidate =>
        (NAVIGATION_TYPE_BUCKETS[candidate].attributeValues as string[]).includes(value)
      );

      if (bucket) {
        counts[bucket] += count;
      }
    }

    return {counts, untaggedCount, isPending};
  }, [data, isPending]);
}
