import {t} from 'sentry/locale';
import type {Tag} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {WidgetType, type GlobalFilter} from 'sentry/views/dashboards/types';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {SpanFields, type BrowserNavigationType} from 'sentry/views/insights/types';

// Enable locally with the command palette's "Add Org Feature Flag".
export const WEB_VITALS_NAVIGATION_TYPE_FEATURE =
  'insights-web-vitals-navigation-type-switcher';

// A function rather than a constant: reading the enum at module load would hit
// an import cycle with the dashboards configs.
export function isWebVitalsPrebuiltDashboard(id: PrebuiltDashboardId): boolean {
  return (
    id === PrebuiltDashboardId.WEB_VITALS || id === PrebuiltDashboardId.WEB_VITALS_SUMMARY
  );
}

/**
 * Page loads are the only population the web vital thresholds were calibrated
 * on. Prerender is its own bucket because its paint timings are offset by
 * `activationStart`.
 */
export enum NavigationTypeBucket {
  PAGE_LOAD = 'pageload',
  SOFT_NAVIGATION = 'soft-navigation',
  BFCACHE = 'bfcache',
  PRERENDER = 'prerender',
}

export const NAVIGATION_TYPE_BUCKET_ORDER: NavigationTypeBucket[] = [
  NavigationTypeBucket.PAGE_LOAD,
  NavigationTypeBucket.SOFT_NAVIGATION,
  NavigationTypeBucket.BFCACHE,
  NavigationTypeBucket.PRERENDER,
];

// All, so an untouched dashboard shows the same numbers it always has.
const DEFAULT_NAVIGATION_TYPE_BUCKETS = NAVIGATION_TYPE_BUCKET_ORDER;

// Filters nothing, so a navigation type the SDK adds later still shows under "All".
const ALL_NAVIGATION_TYPES_VALUE = '';

const NAVIGATION_TYPE_TAG: Tag = {
  key: SpanFields.BROWSER_NAVIGATION_TYPE,
  name: SpanFields.BROWSER_NAVIGATION_TYPE,
  kind: FieldKind.TAG,
};

type NavigationTypeBucketConfig = {
  /** Page loads also match spans with no value at all, see `navigationTypeQuery`. */
  attributeValues: BrowserNavigationType[];
  /** Why this bucket is likely to be empty, shown when it has no data. */
  emptyReason: () => string;
  label: () => string;
  description?: () => string;
  /**
   * Values older SDKs sent. Kept apart from `attributeValues`, which describes
   * what the SDK sends today, and safe to delete once those SDKs are gone.
   */
  legacyAttributeValues?: string[];
};

const KEY = SpanFields.BROWSER_NAVIGATION_TYPE;

export const NAVIGATION_TYPE_BUCKETS: Record<
  NavigationTypeBucket,
  NavigationTypeBucketConfig
> = {
  [NavigationTypeBucket.PAGE_LOAD]: {
    label: () => t('Page loads'),
    description: () =>
      t(
        'Full document loads, including back/forward navigations that missed the bfcache. Also includes spans sent before the SDK started tagging navigation type.'
      ),
    attributeValues: ['navigate', 'reload', 'back-forward', 'restore'],
    emptyReason: () =>
      t('No page load web vitals were recorded for the current filters.'),
  },
  [NavigationTypeBucket.SOFT_NAVIGATION]: {
    label: () => t('Soft navigations'),
    description: () => t('Client-side route changes. No document load.'),
    attributeValues: ['soft-navigation'],
    emptyReason: () =>
      t(
        'Soft navigation vitals require Chromium 151 or newer, so most traffic will not report them yet.'
      ),
  },
  [NavigationTypeBucket.BFCACHE]: {
    label: () => t('bfcache restores'),
    description: () =>
      t('Restores from the back/forward cache. Near-instant by construction.'),
    attributeValues: ['back-forward-cache'],
    // SDKs before the web-vitals rename reported this bucket as `bfcache`.
    legacyAttributeValues: ['bfcache'],
    emptyReason: () =>
      t(
        'No back/forward cache restores were recorded. Restores only happen on pages that are eligible for the bfcache, and older SDK versions do not tag the navigation type.'
      ),
  },
  [NavigationTypeBucket.PRERENDER]: {
    label: () => t('Prerenders'),
    description: () =>
      t('Prerendered pages. Paint timings are offset by activationStart.'),
    attributeValues: ['prerender'],
    emptyReason: () =>
      t('No prerendered page loads were recorded for the current filters.'),
  },
};

export function bucketAttributeValues(bucket: NavigationTypeBucket): string[] {
  const {attributeValues, legacyAttributeValues = []} = NAVIGATION_TYPE_BUCKETS[bucket];
  return [...attributeValues, ...legacyAttributeValues];
}

/** Selection in canonical order, deduped. */
export function normalizeBuckets(
  buckets: NavigationTypeBucket[]
): NavigationTypeBucket[] {
  return NAVIGATION_TYPE_BUCKET_ORDER.filter(bucket => buckets.includes(bucket));
}

// An empty selection counts as "All", matching the other filter chips.
export function isAllBucketsSelected(buckets: NavigationTypeBucket[]): boolean {
  const selected = normalizeBuckets(buckets);
  return selected.length === 0 || selected.length === NAVIGATION_TYPE_BUCKET_ORDER.length;
}

/**
 * The thresholds were derived from page load data, so they only mean something
 * when page loads are the whole selection. "All" keeps them too, since it
 * filters nothing and leaves the dashboard as it was.
 */
export function bucketsKeepThresholds(buckets: NavigationTypeBucket[]): boolean {
  return (
    isAllBucketsSelected(buckets) ||
    (buckets.length === 1 && buckets[0] === NavigationTypeBucket.PAGE_LOAD)
  );
}

/** Query fragment appended to every spans widget for a selection. */
function navigationTypeQuery(buckets: NavigationTypeBucket[]): string {
  const selected = normalizeBuckets(buckets);

  if (selected.length === 0 || selected.length === NAVIGATION_TYPE_BUCKET_ORDER.length) {
    return ALL_NAVIGATION_TYPES_VALUE;
  }

  const values = selected.flatMap(bucket => bucketAttributeValues(bucket));
  const valueClause = `${KEY}:[${values.join(',')}]`;

  // Spans from before the attribute existed were all full document loads, and
  // dropping them would empty every existing chart.
  return selected.includes(NavigationTypeBucket.PAGE_LOAD)
    ? `(${valueClause} OR !has:${KEY})`
    : valueClause;
}

// Enumerating all 16 subsets makes reading a selection back from the URL exact,
// with no query parsing.
const QUERY_TO_BUCKETS: Map<string, NavigationTypeBucket[]> = new Map(
  Array.from({length: 1 << NAVIGATION_TYPE_BUCKET_ORDER.length}, (_, mask) => {
    const subset = NAVIGATION_TYPE_BUCKET_ORDER.filter(
      (_bucket, index) => mask & (1 << index)
    );
    return [navigationTypeQuery(subset), subset] as const;
  })
).set(ALL_NAVIGATION_TYPES_VALUE, NAVIGATION_TYPE_BUCKET_ORDER);

// A value hand-picked from the raw attribute values, like just `navigate`,
// usually can't be represented and stays a plain chip.
export function isSwitcherQuery(value: string): boolean {
  return QUERY_TO_BUCKETS.has(value);
}

export function buildNavigationTypeGlobalFilter(
  buckets: NavigationTypeBucket[]
): GlobalFilter {
  const filter: GlobalFilter = {
    dataset: WidgetType.SPANS,
    tag: NAVIGATION_TYPE_TAG,
    value: navigationTypeQuery(buckets),
  };

  // "All" must match the prebuilt config entry exactly so the dashboard stays
  // saveable. A narrowed selection is temporary so it can't be saved for everyone.
  return isAllBucketsSelected(buckets) ? filter : {...filter, isTemporary: true};
}

export function isNavigationTypeGlobalFilter(filter: GlobalFilter): boolean {
  return (
    filter.dataset === WidgetType.SPANS &&
    filter.tag.key === SpanFields.BROWSER_NAVIGATION_TYPE
  );
}

export function getBucketsFromGlobalFilters(
  filters: GlobalFilter[] | undefined
): NavigationTypeBucket[] {
  const filter = filters?.find(isNavigationTypeGlobalFilter);

  // No filter, or a value the switcher can't represent, reads as "All".
  if (!filter) {
    return DEFAULT_NAVIGATION_TYPE_BUCKETS;
  }

  return QUERY_TO_BUCKETS.get(filter.value) ?? DEFAULT_NAVIGATION_TYPE_BUCKETS;
}
