import {useMemo} from 'react';

import {WidgetType, type GlobalFilter} from 'sentry/views/dashboards/types';
import {webVitalCountField} from 'sentry/views/dashboards/utils/webVitalTraceMetricFields';
import {Referrer} from 'sentry/views/insights/browser/webVitals/referrers';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/browser/webVitals/settings';
import {ORDER} from 'sentry/views/insights/browser/webVitals/types';
import {
  useSpans,
  useTraceMetrics,
} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanFields} from 'sentry/views/insights/types';

import {
  bucketAttributeValues,
  getNavigationTypeDataset,
  isNavigationTypeGlobalFilter,
  NAVIGATION_TYPE_BUCKET_ORDER,
  NavigationTypeBucket,
} from './settings';

const SPAN_COUNT_FIELD = 'count()';

const METRIC_COUNT_FIELDS = ORDER.map(webVitalCountField);

type Props = {
  /** The other active global filters, so the counts match the widgets. */
  globalFilters: GlobalFilter[];
  enabled?: boolean;
};

export type NavigationTypeCounts = {
  counts: Record<NavigationTypeBucket, number>;
  isPending: boolean;
  /** Web vitals with no `browser.navigation.type` at all, counted under page loads. */
  untaggedCount: number;
};

export function useNavigationTypeCounts({
  globalFilters,
  enabled = true,
}: Props): NavigationTypeCounts {
  const dataset = getNavigationTypeDataset(globalFilters);
  const isMetrics = dataset === WidgetType.TRACEMETRICS;
  const additionalQuery = globalFilters
    .filter(
      filter =>
        !isNavigationTypeGlobalFilter(filter) &&
        filter.dataset === dataset &&
        filter.value
    )
    .map(filter => filter.value)
    .join(' ');

  const spans = useSpans(
    {
      enabled: enabled && !isMetrics,
      search: [DEFAULT_QUERY_FILTER, additionalQuery].filter(Boolean).join(' '),
      fields: [SpanFields.BROWSER_NAVIGATION_TYPE, SPAN_COUNT_FIELD],
      sorts: [{field: SPAN_COUNT_FIELD, kind: 'desc'}],
      // One row per distinct navigation type, plus headroom for values the SDK
      // may add later.
      limit: 20,
    },
    Referrer.WEB_VITAL_NAVIGATION_TYPE_COUNTS
  );

  const metrics = useTraceMetrics(
    {
      enabled: enabled && isMetrics,
      search: additionalQuery,
      fields: [SpanFields.BROWSER_NAVIGATION_TYPE, ...METRIC_COUNT_FIELDS],
      sorts: [{field: METRIC_COUNT_FIELDS[0]!, kind: 'desc'}],
      limit: 20,
    },
    Referrer.WEB_VITAL_NAVIGATION_TYPE_COUNTS
  );

  const rows = useMemo(
    () =>
      isMetrics
        ? metrics.data.map(row => ({
            value: String(row[SpanFields.BROWSER_NAVIGATION_TYPE] ?? ''),
            count: METRIC_COUNT_FIELDS.reduce(
              (total, field) => total + Number(row[field] ?? 0),
              0
            ),
          }))
        : spans.data.map(row => ({
            value: String(row[SpanFields.BROWSER_NAVIGATION_TYPE] ?? ''),
            count: Number(row[SPAN_COUNT_FIELD] ?? 0),
          })),
    [isMetrics, metrics.data, spans.data]
  );
  const isPending = isMetrics ? metrics.isPending : spans.isPending;

  return useMemo(() => {
    const counts: Record<NavigationTypeBucket, number> = {
      [NavigationTypeBucket.PAGE_LOAD]: 0,
      [NavigationTypeBucket.SOFT_NAVIGATION]: 0,
      [NavigationTypeBucket.BFCACHE]: 0,
      [NavigationTypeBucket.PRERENDER]: 0,
    };
    let untaggedCount = 0;

    for (const {value, count} of rows) {
      if (!value) {
        untaggedCount += count;
        counts[NavigationTypeBucket.PAGE_LOAD] += count;
        continue;
      }

      const bucket = NAVIGATION_TYPE_BUCKET_ORDER.find(candidate =>
        bucketAttributeValues(candidate).includes(value)
      );

      if (bucket) {
        counts[bucket] += count;
      }
    }

    return {counts, untaggedCount, isPending};
  }, [rows, isPending]);
}
